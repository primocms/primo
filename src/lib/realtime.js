import { supabase } from './supabase';
import {writable, get} from 'svelte/store';
import { createUniqueID } from './editor/utilities';

const presence_key = createUniqueID(10)
const channel = supabase.channel(`locked-blocks`, {
  config: {
    presence: {
      key: presence_key
    }
  }
});

channel.subscribe(async (status) => {
  if (status === 'SUBSCRIBED') {
    channel.track({
      active_block: null
    });
  }
});

export const locked_blocks = writable([]);
channel.on('presence', { event: 'sync' }, () => {
  const state = channel.presenceState();
  locked_blocks.set(
    Object.entries(state).map(([key, value]) => ({
      key,
      block_id: value[0]['active_block'],
      user: value[0]['user']
    })).filter(block => block.key !== presence_key)
  )
})

export function track(arg) {
  channel.track({
    ...arg,
    presence_key
  });
}