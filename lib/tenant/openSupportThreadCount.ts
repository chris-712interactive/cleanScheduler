import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export async function countOpenSupportThreads(
  supabase: SupabaseClient<Database>,
  tenantId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('customer_support_threads')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'open');

  if (error) return 0;
  return count ?? 0;
}

/** Open threads whose latest message is from the customer (needs staff reply). */
export async function countSupportThreadsAwaitingReply(
  supabase: SupabaseClient<Database>,
  tenantId: string,
): Promise<number> {
  const { data: threads, error } = await supabase
    .from('customer_support_threads')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('status', 'open');

  if (error || !threads?.length) return 0;

  const threadIds = threads.map((thread) => thread.id);
  const { data: messages, error: messagesError } = await supabase
    .from('customer_support_messages')
    .select('thread_id, is_from_customer, created_at')
    .in('thread_id', threadIds)
    .order('created_at', { ascending: false });

  if (messagesError) return 0;

  const lastByThread = new Map<string, boolean>();
  for (const message of messages ?? []) {
    if (!lastByThread.has(message.thread_id)) {
      lastByThread.set(message.thread_id, message.is_from_customer);
    }
  }

  let awaiting = 0;
  for (const threadId of threadIds) {
    if (lastByThread.get(threadId) === true) awaiting += 1;
  }
  return awaiting;
}
