/**
 * User-facing message projection only, never an authority or audit boundary.
 * Internal runtime tool/session/trace events remain available to their owners
 * and are not implicitly promoted to messages in the conversation.
 */
const VISIBLE_TYPES=new Set(['text','plan','agent_run','artifact','notice','response','generated']);

export function projectConversationMessages(messages){
  if(!Array.isArray(messages))return [];
  return messages.filter(message=>{
    if(!message||typeof message!=='object'||Array.isArray(message))return false;
    if(typeof message.text!=='string')return false;
    if(message.visibility!==undefined&&message.visibility!=='conversation')return false;
    // Explicitly registered types only: an unrecognized runtime event never
    // appears in chat merely because it has a text payload or an author.
    if(message.type===undefined)return message.author==='user';
    return VISIBLE_TYPES.has(message.type);
  });
}
