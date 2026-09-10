/**
 * Confiance Energy — Worker Cloudflare (Dashboard de Projetos)
 * 
 * Este worker coleta os dados de tarefas (Workgroup ID 1) do Bitrix24.
 * [VERSÃO BATCH OTIMIZADA]
 */

const GROUP_ID = 1;
const CACHE_KEY = 'dashboard_tasks_data';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // ── Auth: senha obrigatória em todas as rotas (mesmo padrão do dashboard comercial: query pwd=) ──
    const pwd = (url.searchParams.get('pwd') || '').trim();
    const expectedPwd = (env.DASHBOARD_PWD || '10203040').trim();
    if (pwd !== expectedPwd) {
      return new Response(JSON.stringify({ erro: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const bitrixWebhook = (env.BITRIX_WEBHOOK || 'https://confianceenergy.bitrix24.com.br/rest/1/umgyd7v8wrsinoqz/').trim().replace(/\/?$/, '/');

    if (request.method === 'GET') {
      const noCache = url.searchParams.get('nocache') === '1';

      if (!noCache && env.RENOMEAR_CACHE) {
        try {
          const cachedData = await env.RENOMEAR_CACHE.get(CACHE_KEY);
          if (cachedData) {
            return new Response(cachedData, {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' }
            });
          }
        } catch (err) {}
      }

      try {
        const payload = await obterDadosBitrix(bitrixWebhook, env);
        const body = JSON.stringify(payload);

        if (env.RENOMEAR_CACHE) {
          ctx.waitUntil(env.RENOMEAR_CACHE.put(CACHE_KEY, body, { expirationTtl: 3600 }));
        }

        return new Response(body, {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ erro: err.message, stack: err.stack }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (request.method === 'POST') {
      if (env.RENOMEAR_CACHE) {
        try {
          await env.RENOMEAR_CACHE.delete(CACHE_KEY);
          return new Response(JSON.stringify({ ok: true, message: 'Cache limpo com sucesso!' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, erro: err.message }), { status: 500, headers: corsHeaders });
        }
      }
      return new Response(JSON.stringify({ ok: true, message: 'Sem KV' }), { status: 200, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ erro: 'Método não suportado' }), { status: 405, headers: corsHeaders });
  }
};

async function bitrixCall(webhookBase, method, body = {}) {
  const url = `${webhookBase}${method}.json`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`Bitrix API Error: HTTP ${response.status}`);
  }
  const data = await response.json();
  if (data.error) throw new Error(`Bitrix ${method}: ${data.error_description || data.error}`);
  return data;
}

async function obterDadosBitrix(webhookBase, env) {
  // 1. Obter Stages
  const stagesReq = await bitrixCall(webhookBase, 'task.stages.get', { entityId: GROUP_ID, entityType: 'G' });
  const stagesRes = stagesReq.result || {};
  const stagesMap = {};
  Object.values(stagesRes).forEach(s => { stagesMap[s.ID] = s.TITLE; });

  // 2. Buscar Tarefas (Paginação normal, pois não sabemos o total e é rápido o suficiente)
  let allTasks = [];
  let start = 0;
  let hasMore = true;

  while (hasMore) {
    const tasksReq = await bitrixCall(webhookBase, 'tasks.task.list', {
      filter: { GROUP_ID: GROUP_ID },
      select: [ 'ID', 'TITLE', 'STAGE_ID', 'STATUS', 'RESPONSIBLE_ID', 'CREATED_DATE', 'CHANGED_DATE', 'CLOSED_DATE', 'DEADLINE', 'ACTIVITY_DATE', 'FORUM_TOPIC_ID', 'CHAT_ID' ],
      order: { CHANGED_DATE: 'DESC' },
      start: start
    });
    
    const pageTasks = (tasksReq.result && tasksReq.result.tasks) ? tasksReq.result.tasks : (Array.isArray(tasksReq.result) ? tasksReq.result : []);
    allTasks = allTasks.concat(pageTasks);

    if (tasksReq.next && pageTasks.length === 50) {
      start = tasksReq.next;
    } else {
      hasMore = false;
    }
  }

  // 3. Usuários
  const responsibleIds = [...new Set(allTasks.map(t => t.responsibleId || t.RESPONSIBLE_ID).filter(Boolean))];
  const userMap = {};
  if (responsibleIds.length > 0) {
    try {
      const usersReq = await bitrixCall(webhookBase, 'user.get', { FILTER: { ID: responsibleIds } });
      const usersList = Array.isArray(usersReq.result) ? usersReq.result : Object.values(usersReq.result || {});
      usersList.forEach(u => { userMap[u.ID] = `${u.NAME || ''} ${u.LAST_NAME || ''}`.trim() || `Usuário #${u.ID}`; });
    } catch (err) {}
  }

  // 4. Buscar Comentários via IM Chat + Histórico de Vistorias
  const commentsData = {};
  const historyData = {};
  const BATCH_SIZE = 50;

  // Helper: limpar BBCode do Bitrix e extrair texto limpo
  function cleanBBCode(text) {
    if (!text) return '';
    // Extrair nome de [USER=id]Nome[/USER] -> Nome
    text = text.replace(/\[USER=\d+\]([^\[]+)\[\/USER\]/g, '$1');
    // Remover tags BBCode restantes
    text = text.replace(/\[\/?[A-Z_=0-9]+\]/gi, '');
    // Remover timestamps do Bitrix
    text = text.replace(/\[TIMESTAMP=\d+\s+FORMAT=[^\]]+\]/g, '');
    // Remover URLs BBCode, manter texto
    text = text.replace(/\[URL=[^\]]+\]([^\[]+)\[\/URL\]/g, '$1');
    return text.trim();
  }

  // -- Comentários via IM Chat (sistema novo do Bitrix24) --
  // Mapear taskId -> chatId
  const taskChatMap = {};
  allTasks.forEach(t => {
    const taskId = t.id || t.ID;
    const chatId = t.chatId || t.CHAT_ID;
    if (taskId && chatId) {
      taskChatMap[taskId] = chatId;
    }
  });

  // Montar batches de im.dialog.messages.get para todas as tarefas com chatId
  const taskIds = Object.keys(taskChatMap);
  const chatBatches = [];
  for (let i = 0; i < taskIds.length; i += BATCH_SIZE) {
    const chunk = taskIds.slice(i, i + BATCH_SIZE);
    const cmds = {};
    chunk.forEach(taskId => {
      const chatId = taskChatMap[taskId];
      cmds[`m_${taskId}`] = `im.dialog.messages.get?DIALOG_ID=chat${chatId}&LIMIT=10`;
    });
    chatBatches.push(cmds);
  }

  const commentPromises = chatBatches.map(cmds =>
    bitrixCall(webhookBase, 'batch', { halt: 0, cmd: cmds })
      .then(resp => {
        const batchRes = (resp.result && resp.result.result) ? resp.result.result : {};
        Object.keys(batchRes).forEach(key => {
          const taskId = key.replace('m_', '');
          const chatResult = batchRes[key];
          if (chatResult && chatResult.messages && Array.isArray(chatResult.messages)) {
            // Filtrar: apenas mensagens de humanos (author_id > 0), ignorar sistema (author_id === 0)
            const humanMsgs = chatResult.messages.filter(m => m.author_id && parseInt(m.author_id) > 0);
            if (humanMsgs.length > 0) {
              // Extrair nomes dos autores do chatResult.users se disponível
              const chatUsers = {};
              if (chatResult.users && Array.isArray(chatResult.users)) {
                chatResult.users.forEach(u => {
                  chatUsers[u.id] = u.name || `Usuário #${u.id}`;
                });
              }
              commentsData[taskId] = humanMsgs.map(m => ({
                author: chatUsers[m.author_id] || userMap[m.author_id] || `Usuário #${m.author_id}`,
                text: cleanBBCode(m.text || ''),
                date: m.date || ''
              }));
            }
          }
        });
      })
      .catch(e => console.error('Chat batch error:', e.message))
  );

  // -- Histórico: buscar para TODAS as tarefas para descobrir stage_entered_at e approved_at --
  const historyBatches = [];
  for (let i = 0; i < allTasks.length; i += BATCH_SIZE) {
    const chunk = allTasks.slice(i, i + BATCH_SIZE);
    const cmds = {};
    chunk.forEach(task => {
      const taskId = task.id || task.ID;
      if (taskId) {
        cmds[`h_${taskId}`] = `tasks.task.history.list?taskId=${taskId}&filter[FIELD]=STAGE_ID`;
      }
    });
    historyBatches.push(cmds);
  }

  const historyPromises = historyBatches.map(cmds =>
    bitrixCall(webhookBase, 'batch', { halt: 0, cmd: cmds })
      .then(resp => {
        const batchRes = (resp.result && resp.result.result) ? resp.result.result : {};
        Object.keys(batchRes).forEach(key => {
          const taskId = key.replace('h_', '');
          const histArray = batchRes[key];
          
          if (Array.isArray(histArray) && histArray.length > 0) {
            // Ordenar por ID ou data de criação para garantir ordem cronológica
            histArray.sort((a, b) => {
              const idA = parseInt(a.id || a.ID) || 0;
              const idB = parseInt(b.id || b.ID) || 0;
              return idB - idA; // Descendente: mais recentes primeiro
            });

            // Encontrar transition para SLA (stage 19)
            const approvedTransition = histArray.find(h => h.TO_VALUE === '19' || h.toValue === '19');
            
            // Encontrar transition mais recente (que define o stage_entered_at)
            // A última transição da lista ordenada será a entrada na etapa atual
            const latestTransition = histArray[0];

            historyData[taskId] = {
              approved_at: approvedTransition ? (approvedTransition.CREATED_DATE || approvedTransition.createdDate) : null,
              stage_entered_at: latestTransition ? (latestTransition.CREATED_DATE || latestTransition.createdDate) : null
            };
          } else {
            historyData[taskId] = { approved_at: null, stage_entered_at: null };
          }
        });
      })
      .catch(e => console.error('History batch error:', e.message))
  );

  // Aguardar tudo em paralelo
  await Promise.all([...commentPromises, ...historyPromises]);

  // 5. Estruturar o payload final
  const mappedTasks = [];

  for (const t of allTasks) {
    const taskId = t.id || t.ID;
    const stageId = (t.stageId || t.STAGE_ID || '').toString();
    const responsibleId = t.responsibleId || t.RESPONSIBLE_ID;
    const title = t.title || t.TITLE || '';
    const createdDate = t.createdDate || t.CREATED_DATE || null;
    const changedDate = t.changedDate || t.CHANGED_DATE || null;
    const closedDate = t.closedDate || t.CLOSED_DATE || null;
    const deadline = t.deadline || t.DEADLINE || null;

    const stageName = stagesMap[stageId] || 'Sem status';
    const responsibleName = userMap[responsibleId] || `Usuário #${responsibleId}`;
    
    const hist = historyData[taskId] || { approved_at: null, stage_entered_at: null };
    let approvedAt = hist.approved_at;
    let stageEnteredAt = hist.stage_entered_at;

    // Fallback se não encontrou histórico para approved_at (projetos antigos)
    if (!approvedAt && ['19', '161', '127', '11'].includes(stageId)) {
       approvedAt = closedDate || changedDate;
    }

    // Fallback para stage_entered_at (se não tem histórico de transição, usa a data de criação/mudança)
    if (!stageEnteredAt) {
      stageEnteredAt = changedDate || createdDate;
    }

    mappedTasks.push({
      id: parseInt(taskId, 10),
      title: title,
      status: stageName,
      responsible: responsibleName,
      created_at: createdDate,
      updated_at: changedDate,
      stage_entered_at: stageEnteredAt,
      deadline: deadline,
      approved_at: approvedAt,
      comments: commentsData[taskId] || []
    });
  }

  return {
    last_updated: new Date().toISOString(),
    tasks: mappedTasks
  };
}
