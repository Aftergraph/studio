export function renderChatView({
  header='',takeover='',messages='',live='',actions='',composer='',meta='',artifact='',artifactOpen=false,liveState='idle',controlMode='observe',
}={}){
  return `<div class="ag-calm-chat ag-chat-workspace ${artifactOpen?'with-artifact':''}">
    <main id="main-content" class="ag-conversation ag-calm-conversation" data-live-state="${String(liveState)}" data-control-mode="${String(controlMode)}">
      ${header}${takeover}
      <div id="message-list" class="ag-message-stream ag-reading-stream" data-scroll-key="conversation-stream">${messages}</div>
      ${live}
      <div class="ag-composer-wrap ag-calm-composer-wrap">${actions}${composer}${meta}</div>
    </main>
    ${artifact}
  </div>`;
}
