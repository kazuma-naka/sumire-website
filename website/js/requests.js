const form = document.querySelector("#submission-form");
const fieldsRoot = document.querySelector("#form-fields");
const kindButtons = [...document.querySelectorAll(".request-type")];
const submitButton = document.querySelector("#submit-button");
const formMessage = document.querySelector("#form-message");
const turnstileHint = document.querySelector("#turnstile-hint");
const publicList = document.querySelector("#public-list");
const publicError = document.querySelector("#public-error");
const publicStatus = document.querySelector("#public-status");
let selectedKind = "dictionary";
let turnstileId = null;
let turnstileToken = "";
let turnstileReady = false;

const field = (name, label, { type = "text", required = false, max = 120, wide = false, hint = "" } = {}) => {
  const wrapper = document.createElement("div");
  wrapper.className = `form-field${wide ? " form-field-wide" : ""}`;
  const labelNode = document.createElement("label");
  labelNode.htmlFor = `field-${name}`;
  labelNode.append(document.createTextNode(label));
  if (required) {
    const marker = document.createElement("span");
    marker.className = "required";
    marker.textContent = "必須";
    labelNode.append(marker);
  }
  wrapper.append(labelNode);
  const input = document.createElement(type === "textarea" ? "textarea" : "input");
  input.id = `field-${name}`;
  input.name = name;
  input.maxLength = max;
  if (required) input.required = true;
  if (type === "textarea") input.rows = 4;
  else input.type = type;
  wrapper.append(input);
  if (hint) {
    const small = document.createElement("small");
    small.textContent = hint;
    wrapper.append(small);
  }
  return wrapper;
};

const selectField = (name, label, options) => {
  const wrapper = document.createElement("div");
  wrapper.className = "form-field";
  const labelNode = document.createElement("label");
  labelNode.htmlFor = `field-${name}`;
  labelNode.append(document.createTextNode(label));
  const marker = document.createElement("span");
  marker.className = "required";
  marker.textContent = "必須";
  labelNode.append(marker);
  wrapper.append(labelNode);
  const select = document.createElement("select");
  select.id = `field-${name}`;
  select.name = name;
  select.required = true;
  const prompt = document.createElement("option");
  prompt.value = "";
  prompt.textContent = "選択してください";
  select.append(prompt);
  options.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  });
  wrapper.append(select);
  return wrapper;
};

function renderFields() {
  fieldsRoot.replaceChildren();
  const grid = document.createElement("div");
  grid.className = "form-grid";
  if (selectedKind === "dictionary") {
    grid.append(field("term", "単語", { required: true, max: 100 }));
    grid.append(field("reading", "読み（ひらがな）", { required: true, max: 100 }));
    grid.append(field("partOfSpeech", "品詞・種類", { max: 50, hint: "例：名詞、固有名詞。わからなければ空欄で構いません。" }));
    grid.append(field("context", "用例・補足", { type: "textarea", max: 600, wide: true }));
  } else if (selectedKind === "bug") {
    grid.append(field("title", "不具合の概要", { required: true, max: 120 }));
    grid.append(selectField("appEdition", "利用しているエディション", [["full", "Full"], ["lite", "Lite"], ["unsure", "わからない"]]));
    grid.append(field("appVersion", "Sumire のバージョン", { max: 32, hint: "設定の「アプリについて」などで確認できます。" }));
    grid.append(field("androidVersion", "Android のバージョン", { max: 32 }));
    grid.append(field("steps", "再現手順", { type: "textarea", required: true, max: 2000, wide: true, hint: "どの画面で何をすると起きるかを、順番に記入してください。" }));
    grid.append(field("expected", "期待していた結果", { type: "textarea", max: 800 }));
    grid.append(field("actual", "実際に起きたこと", { type: "textarea", max: 800 }));
  } else {
    grid.append(field("title", "提案のタイトル", { required: true, max: 120, wide: true }));
    grid.append(field("description", "提案の内容", { type: "textarea", required: true, max: 1600, wide: true, hint: "どんな場面で、どう使えるとよいかを書いてください。" }));
    grid.append(selectField("targetEdition", "対象エディション", [["full", "Full"], ["lite", "Lite"], ["either", "どちらでも"]]));
  }
  fieldsRoot.append(grid);
}

function showMessage(message, type = "") {
  formMessage.hidden = false;
  formMessage.className = `form-message${type ? ` is-${type}` : ""}`;
  formMessage.textContent = message;
}

function resetCaptcha() {
  turnstileToken = "";
  submitButton.disabled = true;
  if (turnstileReady && turnstileId !== null) window.turnstile.reset(turnstileId);
}

kindButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedKind = button.dataset.kind;
    for (const item of kindButtons) {
      const isSelected = item === button;
      item.classList.toggle("is-selected", isSelected);
      item.setAttribute("aria-pressed", String(isSelected));
    }
    formMessage.hidden = true;
    renderFields();
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage.hidden = true;
  if (!form.reportValidity()) return;
  if (!turnstileToken) {
    showMessage("投稿前にスパム防止の確認を完了してください。", "error");
    return;
  }
  submitButton.disabled = true;
  submitButton.textContent = "送信しています…";
  const payload = Object.fromEntries(new FormData(form).entries());
  const contactEmail = document.querySelector("#contact-email").value.trim();
  delete payload.contactEmail;
  try {
    const response = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ kind: selectedKind, payload, contactEmail, turnstileToken }),
    });
    const result = await response.json();
    if (!response.ok) {
      if (result.fields) {
        for (const [name, message] of Object.entries(result.fields)) {
          const invalidField = form.elements.namedItem(name);
          if (invalidField) invalidField.setCustomValidity(message);
        }
        form.reportValidity();
        for (const control of form.querySelectorAll("input,select,textarea")) control.addEventListener("input", () => control.setCustomValidity(""), { once: true });
      }
      throw new Error(result.error || "投稿を送信できませんでした。");
    }
    showMessage("投稿を受け付けました。公開前に内容を確認します。", "success");
    form.reset();
    document.querySelector("#contact-email").value = "";
    resetCaptcha();
    window.scrollTo({ top: formMessage.getBoundingClientRect().top + window.scrollY - 100, behavior: "smooth" });
  } catch (error) {
    showMessage(error.message || "通信に失敗しました。時間をおいて再度お試しください。", "error");
    if (turnstileToken) resetCaptcha();
  } finally {
    submitButton.innerHTML = '投稿を送る <span aria-hidden="true">→</span>';
    submitButton.disabled = !turnstileToken;
  }
});

function kindLabel(kind) {
  return ({ dictionary: "辞書の単語", bug: "不具合報告", feature: "機能提案" })[kind] || "投稿";
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric" }).format(date);
}

function publicCard(item) {
  const article = document.createElement("article");
  article.className = "public-card";
  const top = document.createElement("div");
  top.className = "public-card-top";
  const kind = document.createElement("span");
  kind.className = "public-kind";
  kind.textContent = kindLabel(item.kind);
  const status = document.createElement("span");
  status.className = `status-pill ${item.status || ""}`;
  status.textContent = item.statusLabel || "確認中";
  top.append(kind, status);
  article.append(top);
  const title = document.createElement("h3");
  title.textContent = item.title;
  article.append(title);
  const description = document.createElement("p");
  description.textContent = item.description;
  article.append(description);
  if (item.updatedAt) {
    const time = document.createElement("time");
    time.dateTime = item.updatedAt;
    time.textContent = `更新：${formatDate(item.updatedAt)}`;
    article.append(time);
  }
  return article;
}

async function loadPublicList() {
  try {
    const response = await fetch("/api/submissions", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("list_load_failed");
    const result = await response.json();
    if (!Array.isArray(result.submissions) || result.submissions.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "承認された投稿はまだありません。投稿は確認・承認後に公開されます。";
      publicList.replaceChildren(empty);
      publicStatus.textContent = "承認された投稿はありません。";
      return;
    }
    publicList.replaceChildren(...result.submissions.map(publicCard));
    publicStatus.textContent = `承認された投稿を ${result.submissions.length} 件表示しています。`;
  } catch {
    publicList.replaceChildren();
    publicError.hidden = false;
    publicStatus.textContent = "投稿一覧の読み込みに失敗しました。";
  }
}

async function setupTurnstile() {
  try {
    const configResponse = await fetch("/api/config", { headers: { Accept: "application/json" } });
    const config = await configResponse.json();
    if (!configResponse.ok || !config.turnstileSiteKey) throw new Error("captcha_not_configured");
    const deadline = Date.now() + 8_000;
    while (!window.turnstile && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
    if (!window.turnstile) throw new Error("captcha_not_available");
    turnstileReady = true;
    turnstileId = window.turnstile.render("#turnstile-widget", {
      sitekey: config.turnstileSiteKey,
      action: "request_submit",
      callback: (token) => {
        turnstileToken = token;
        submitButton.disabled = false;
        turnstileHint.textContent = "スパム防止の確認が完了しました。";
      },
      "expired-callback": () => {
        turnstileToken = "";
        submitButton.disabled = true;
        turnstileHint.textContent = "確認の有効期限が切れました。もう一度確認してください。";
      },
      "error-callback": () => {
        turnstileToken = "";
        submitButton.disabled = true;
        turnstileHint.textContent = "確認を読み込めません。通信を確認して再読み込みしてください。";
      },
    });
  } catch {
    turnstileHint.textContent = "スパム防止の確認を読み込めません。設定または通信を確認してください。";
    submitButton.disabled = true;
  }
}

renderFields();
loadPublicList();
setupTurnstile();
