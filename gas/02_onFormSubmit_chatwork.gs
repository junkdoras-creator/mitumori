/**
 * フォーム送信 → チャットワークへ自動通知する Google Apps Script
 *
 * セットアップ：
 *  1. 01_createForm.gs と同じプロジェクト（またはフォームにバインドしたプロジェクト）に貼り付け
 *  2. スクリプトプロパティに以下を登録（［プロジェクトの設定］→［スクリプト プロパティ］）
 *       CHATWORK_TOKEN   … チャットワークの API トークン
 *       CHATWORK_ROOM_ID … 通知先ルームID（チャットのURL末尾の数字）
 *       FORM_ID          … 対象フォームのID（01の実行ログに出力される）
 *  3. installChatworkTrigger を一度だけ実行 → フォーム送信トリガーが作られる
 *
 * 以降、フォームが送信されるたびに該当ルームへ依頼内容が自動投稿される。
 */

function installChatworkTrigger() {
  var formId = PropertiesService.getScriptProperties().getProperty('FORM_ID');
  if (!formId) throw new Error('スクリプトプロパティ FORM_ID が未設定です。');

  // 二重登録を防ぐため既存トリガーを削除
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'notifyChatworkOnSubmit') ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger('notifyChatworkOnSubmit')
    .forForm(FormApp.openById(formId))
    .onFormSubmit()
    .create();

  Logger.log('チャットワーク通知トリガーを登録しました。');
}

function notifyChatworkOnSubmit(e) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('CHATWORK_TOKEN');
  var roomId = props.getProperty('CHATWORK_ROOM_ID');
  if (!token || !roomId) {
    Logger.log('CHATWORK_TOKEN / CHATWORK_ROOM_ID が未設定です。');
    return;
  }

  var lines = ['[info][title]【電子申告・製本・郵送依頼】[/title]'];

  var email = e.response.getRespondentEmail();
  if (email) lines.push('依頼者（メール）: ' + email);

  e.response.getItemResponses().forEach(function (ir) {
    var ans = ir.getResponse();
    if (Array.isArray(ans)) ans = ans.join(' / ');
    if (ans === '' || ans == null) return;     // 未回答（不要でスキップした項目）は出力しない
    lines.push(ir.getItem().getTitle() + ': ' + ans);
  });

  lines.push('[/info]');
  lines.push('↑ 受託する方はリアクションをお願いします。郵送前に必ず依頼者へ最終確認してください。');

  var body = lines.join('\n');

  UrlFetchApp.fetch('https://api.chatwork.com/v2/rooms/' + roomId + '/messages', {
    method: 'post',
    headers: { 'X-ChatWorkToken': token },
    payload: { body: body, self_unread: '1' },
    muteHttpExceptions: true
  });
}
