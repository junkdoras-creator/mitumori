/**
 * 電子申告・製本・郵送 依頼フォームを自動生成する Google Apps Script
 *
 * 使い方：
 *  1. https://script.google.com で新規プロジェクトを作成し、このコードを貼り付け
 *  2. createIraiForm を実行（初回は承認が必要）
 *  3. 実行ログに出力される「編集URL／回答URL／フォームID」を控える
 *  4. 依頼者リスト（STAFF_LIST）を自社の社員名に書き換える
 *
 * メモ：
 *  - 「要/不要」をラジオにし、Googleフォームのセクション分岐で
 *    不要なら詳細をスキップする構成にしている（記入の手間を削減）。
 *  - 依頼者は STAFF_LIST のプルダウン。全員が同一 Google Workspace なら
 *    setCollectEmail(true) でメール自動収集にして、プルダウンを外してもよい。
 */

// ▼▼ 自社に合わせて編集 ▼▼
var STAFF_LIST = ['※社員名を設定してください', '小宮', '田中'];
var YEAR_BACK = 5;     // 対象事業年度のプルダウンを何年分さかのぼるか
// ▲▲ ここまで ▲▲

function createIraiForm() {
  var form = FormApp.create('電子申告・製本・郵送 依頼フォーム')
    .setDescription('達人へのデータ取込完了後に入力してください。★は必須項目です。')
    .setCollectEmail(true)        // 依頼者の控え・自動収集（同一Workspace前提。不要なら false）
    .setAllowResponseEdits(true)
    .setProgressBar(true);

  // ===== ■基本情報（1ページ目） =====
  form.addSectionHeaderItem().setTitle('■ 基本情報');

  form.addTextItem()
    .setTitle('顧問先名（達人コード）★')
    .setRequired(true);

  form.addListItem()
    .setTitle('依頼者（社員名）★')
    .setHelpText('郵送前の最終確認の戻し先になります。')
    .setChoiceValues(STAFF_LIST)
    .setRequired(true);

  var thisYear = new Date().getFullYear();
  var years = [];
  for (var y = thisYear + 1; y >= thisYear - YEAR_BACK; y--) years.push(y + '年度');
  form.addListItem()
    .setTitle('対象事業年度 ★')
    .setChoiceValues(years)
    .setRequired(true);

  var months = [];
  for (var m = 1; m <= 12; m++) months.push(m + '月');
  form.addListItem()
    .setTitle('決算月 ★')
    .setChoiceValues(months)
    .setRequired(true);

  // 「① 電子申告は必要ですか？」（このページに置いて分岐を制御）
  var q申告 = form.addMultipleChoiceItem().setTitle('① 電子申告は必要ですか？ ★').setRequired(true);

  // ===== ① 電子申告（詳細ページ） =====
  var pg申告 = form.addPageBreakItem().setTitle('① 電子申告');

  form.addDateItem().setTitle('期限 ★').setRequired(true);

  form.addCheckboxItem()
    .setTitle('対象税目 ★')
    .setChoiceValues(['法人税', '消費税', '都道府県', '市町村'])
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('申告先自治体')
    .setHelpText('都道府県・市町村を選んだ場合は必須。複数・23区外は必ず明記してください。');

  form.addMultipleChoiceItem()
    .setTitle('添付書類の有無')
    .setChoiceValues(['なし', 'あり'])
    .showOtherOption(false);
  form.addTextItem().setTitle('添付書類（「あり」の場合：具体的に）');

  form.addMultipleChoiceItem()
    .setTitle('納付情報の要否')
    .setChoiceValues(['不要', 'ペイジー番号発行', '納付情報発行依頼まで']);

  // ===== ② 製本：要否ページ =====
  var pgQ製本 = form.addPageBreakItem().setTitle('② 製本');
  var q製本 = form.addMultipleChoiceItem().setTitle('② 製本は必要ですか？ ★').setRequired(true);

  // ===== ② 製本：詳細ページ =====
  var pg製本 = form.addPageBreakItem().setTitle('② 製本（詳細）');
  form.addMultipleChoiceItem()
    .setTitle('期限')
    .setChoiceValues(['日付指定', 'いつでも'])
    .showOtherOption(false);
  form.addDateItem().setTitle('期限日（「日付指定」の場合）');
  form.addMultipleChoiceItem()
    .setTitle('特記事項')
    .setChoiceValues(['なし', '元帳添付', '議事録添付'])
    .showOtherOption(true);   // その他＝自由記入

  // ===== ③ 郵送：要否ページ =====
  var pgQ郵送 = form.addPageBreakItem().setTitle('③ 郵送');
  var q郵送 = form.addMultipleChoiceItem().setTitle('③ 郵送は必要ですか？ ★').setRequired(true);

  // ===== ③ 郵送：詳細ページ =====
  var pg郵送 = form.addPageBreakItem().setTitle('③ 郵送（詳細）');
  form.addMultipleChoiceItem()
    .setTitle('期限')
    .setChoiceValues(['日付指定', 'いつでも'])
    .showOtherOption(false);
  form.addDateItem().setTitle('期限日（「日付指定」の場合）');
  form.addMultipleChoiceItem()
    .setTitle('お届け先')
    .setChoiceValues(['法人住所', '社長自宅'])
    .showOtherOption(true);   // 別住所＝自由記入
  form.addMultipleChoiceItem()
    .setTitle('郵送方法')
    .setChoiceValues(['エコ配', '青レタパ', '赤レタパ'])
    .showOtherOption(false);
  form.addCheckboxItem()
    .setTitle('同封物')
    .setChoiceValues(['納付書', '返送資料'])
    .showOtherOption(true);   // その他＝自由記入

  // ===== セクション分岐（要/不要）の設定 =====
  // 申告：要→続行（詳細へ）／不要→製本の要否ページへ
  q申告.setChoices([
    q申告.createChoice('要', FormApp.PageNavigationType.CONTINUE),
    q申告.createChoice('不要', pgQ製本)
  ]);
  pg申告.setGoToPage(pgQ製本); // 申告詳細の後は製本の要否へ

  // 製本：要→続行（詳細へ）／不要→郵送の要否ページへ
  q製本.setChoices([
    q製本.createChoice('要', FormApp.PageNavigationType.CONTINUE),
    q製本.createChoice('不要', pgQ郵送)
  ]);
  pg製本.setGoToPage(pgQ郵送); // 製本詳細の後は郵送の要否へ

  // 郵送：要→続行（詳細へ）／不要→送信
  q郵送.setChoices([
    q郵送.createChoice('要', FormApp.PageNavigationType.CONTINUE),
    q郵送.createChoice('不要', FormApp.PageNavigationType.SUBMIT)
  ]);
  pg郵送.setGoToPage(FormApp.PageNavigationType.SUBMIT);

  // ===== 出力 =====
  Logger.log('編集URL : ' + form.getEditUrl());
  Logger.log('回答URL : ' + form.getPublishedUrl());
  Logger.log('フォームID : ' + form.getId());
}
