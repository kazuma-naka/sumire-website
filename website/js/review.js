const authForm = document.querySelector("#admin-auth");
const tokenInput = document.querySelector("#admin-token");
const adminMessage = document.querySelector("#admin-message");
const pendingList = document.querySelector("#pending-list");
let adminToken = "";

const labelFor = {
  term: "単語", reading: "読み", partOfSpeech: "品詞", context: "用例・補足",
  title: "概要・タイトル", appEdition: "エディション", appVersion: "Sumire のバージョン",
  androidVersion: "Android のバージョン", steps: "再現手順", expected: "期待する結果",
  actual: "実際の結果", description: "提案の内容", targetEdition: "対象エディション",
};
const kindLabel = { dictionary: "辞書の単語", bug: "不具合報告", feature: "機能提案" };
const publicStatuses = [
  ["under_review", "検討中"], ["planned", "対応予定"], ["in_progress", "対応中"],
  ["completed", "完了"], ["not_planned", "見送り"],
];

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showAdminMessage(message, isError = false) {
  adminMessage.hidden = false;
  adminMessage.className = `form-message${isError ? " is-error" : ""}`;
  adminMessage.textContent = message;
}

async function adminFetch(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { Accept: "application/json", Authorization: `Bearer ${adminToken}`, ...(options.headers || {}) },
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401) {
      adminToken = "";
      tokenInput.value = "";
    }
    throw new Error(result.error || "管理操作に失敗しました。");
  }
  return result;
}

function submissionCard(item) {
  const article = element("article", "pending-card");
  const title = element("h2", "", `${kindLabel[item.kind] || "投稿"} ・ ${item.id.slice(0, 8)}`);
  article.append(title);
  const detail = document.createElement("dl");
  detail.className = "pending-payload";
  for (const [key, rawValue] of Object.entries(item.payload || {})) {
    if (rawValue === "" || rawValue === null || rawValue === undefined) continue;
    const row = document.createElement("div");
    row.append(element("dt", "", labelFor[key] || key));
    row.append(element("dd", "", String(rawValue)));
    detail.append(row);
  }
  if (item.contactEmail) {
    const row = document.createElement("div");
    row.append(element("dt", "", "連絡先（非公開）"));
    row.append(element("dd", "", item.contactEmail));
    detail.append(row);
  }
  rowDate(detail, item.createdAt);
  article.append(detail);

  const moderation = element("div", "moderation-fields");
  const titleField = document.createElement("div");
  titleField.className = "form-field";
  const publicTitleLabel = element("label", "", "公開タイトル");
  const publicTitle = document.createElement("input");
  publicTitle.type = "text";
  publicTitle.maxLength = 160;
  publicTitle.required = true;
  publicTitle.value = item.kind === "dictionary"
    ? `${item.payload.term || ""}（${item.payload.reading || ""}）`
    : item.payload.title || "";
  titleField.append(publicTitleLabel, publicTitle);
  const descriptionField = document.createElement("div");
  descriptionField.className = "form-field";
  const descriptionLabel = element("label", "", "公開する説明文");
  const description = document.createElement("textarea");
  description.rows = 3;
  description.maxLength = 1000;
  description.required = true;
  description.value = item.kind === "dictionary"
    ? item.payload.context || item.payload.partOfSpeech || "辞書への追加要望"
    : item.payload.description || [item.payload.steps, item.payload.actual].filter(Boolean).join("\n");
  descriptionField.append(descriptionLabel, description);
  const statusField = document.createElement("div");
  statusField.className = "form-field";
  const statusLabel = element("label", "", "公開ステータス");
  const status = document.createElement("select");
  for (const [value, label] of publicStatuses) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    status.append(option);
  }
  statusField.append(statusLabel, status);
  moderation.append(titleField, descriptionField, statusField);
  const actions = element("div", "moderation-actions");
  const reject = element("button", "button button-danger", "却下して非公開");
  reject.type = "button";
  const approve = element("button", "button button-primary", "承認して公開");
  approve.type = "button";
  reject.addEventListener("click", () => decide(item.id, "reject", null, article));
  approve.addEventListener("click", () => {
    if (!titleField.querySelector("input").reportValidity() || !description.reportValidity()) return;
    decide(item.id, "approve", { publicTitle: publicTitle.value, publicDescription: description.value, publicStatus: status.value }, article);
  });
  actions.append(reject, approve);
  moderation.append(actions);
  article.append(moderation);
  return article;
}

function rowDate(detail, value) {
  const row = document.createElement("div");
  row.append(element("dt", "", "受信日時"));
  const date = new Date(value);
  row.append(element("dd", "", Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(date)));
  detail.append(row);
}

async function loadPending() {
  pendingList.setAttribute("aria-busy", "true");
  pendingList.replaceChildren();
  try {
    const result = await adminFetch("/api/admin/submissions");
    if (!Array.isArray(result.submissions) || !result.submissions.length) {
      pendingList.append(element("p", "no-pending", "審査待ちの投稿はありません。"));
      return;
    }
    pendingList.append(...result.submissions.map(submissionCard));
  } catch (error) {
    showAdminMessage(error.message, true);
  } finally {
    pendingList.setAttribute("aria-busy", "false");
  }
}

async function decide(id, decision, publicCopy, article) {
  const buttons = article.querySelectorAll("button");
  buttons.forEach((button) => { button.disabled = true; });
  try {
    const result = await adminFetch(`/api/admin/submissions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, ...(publicCopy || {}) }),
    });
    showAdminMessage(result.message);
    article.remove();
    if (!pendingList.querySelector(".pending-card")) pendingList.append(element("p", "no-pending", "審査待ちの投稿はありません。"));
  } catch (error) {
    showAdminMessage(error.message, true);
    buttons.forEach((button) => { button.disabled = false; });
  }
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminMessage.hidden = true;
  adminToken = tokenInput.value.trim();
  if (!adminToken) return;
  tokenInput.value = "";
  try {
    await loadPending();
    if (!adminMessage.hidden && adminMessage.classList.contains("is-error")) return;
    showAdminMessage("認証しました。審査待ちの投稿を表示しています。");
  } catch (error) {
    showAdminMessage(error.message, true);
  }
});
