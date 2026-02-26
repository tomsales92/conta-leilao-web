// Edge Function: cria usuário com Auth Admin API (aceita qualquer e-mail, inclusive corporativo).
// Só pode ser chamada por um usuário com role = 'admin' no perfil.
// Uso: POST com Authorization: Bearer <jwt_do_admin> e body JSON com email, password, first_name, last_name, date_of_birth, gender, plan, role.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getUserIdFromJwt(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload));
    return decoded.sub ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Authorization header required (Bearer token)' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const callerId = getUserIdFromJwt(token);
  if (!callerId) {
    return new Response(
      JSON.stringify({ error: 'Token inválido' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', callerId)
    .single();

  if (callerProfile?.role !== 'admin') {
    return new Response(
      JSON.stringify({ error: 'Apenas administradores podem criar usuários' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let body: {
    email?: string;
    password?: string;
    first_name?: string | null;
    last_name?: string | null;
    date_of_birth?: string | null;
    gender?: string | null;
    plan?: string;
    role?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Body JSON inválido' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const email = (body.email ?? '').trim();
  const password = body.password ?? '';
  if (!email || !password) {
    return new Response(
      JSON.stringify({ error: 'E-mail e senha são obrigatórios' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: userData, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: body.first_name ?? undefined,
      last_name: body.last_name ?? undefined,
      date_of_birth: body.date_of_birth ?? undefined,
      gender: body.gender ?? undefined,
    },
  });

  if (createError) {
    const msg = createError.message ?? 'Erro ao criar usuário';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const userId = userData?.user?.id;
  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'Usuário não foi criado' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const plan = body.plan === 'premium' ? 'premium' : 'free';
  const role = body.role === 'admin' ? 'admin' : 'user';

  const { data: profile, error: updateError } = await admin
    .from('profiles')
    .update({ plan, role })
    .eq('id', userId)
    .select()
    .single();

  if (updateError) {
    return new Response(
      JSON.stringify({ error: 'Perfil criado mas falha ao atualizar plan/role: ' + updateError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify(profile), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
