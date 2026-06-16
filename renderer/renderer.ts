const $list = document.getElementById("list") as HTMLElement;
const $log = document.getElementById("log") as HTMLElement;
const $input = document.getElementById("input") as HTMLInputElement;
const $count = document.getElementById("count") as HTMLElement;
const $suggest = document.getElementById("suggest") as HTMLElement;

type LogType = "info" | "ok" | "err" | "cmd";
type DropPlace = "before" | "after";

let todos: Todo[] = [];
const cmdHistory: string[] = [];
let historyIdx = -1;

// ---- persistence ----
async function load(): Promise<void> {
  todos = await window.api.loadTodos();
  render();
}
function persist(): void {
  window.api.saveTodos(JSON.parse(JSON.stringify(todos)));
}
function nextId(): number {
  return todos.reduce((max, t) => Math.max(max, t.id), 0) + 1;
}

// ---- rendering ----
let dragId: number | null = null;
let lastDragEnd = 0;

function render(): void {
  $list.innerHTML = "";
  todos.forEach((t, i) => {
    const li = document.createElement("li");
    li.className = "item" + (t.done ? " done" : "");
    li.draggable = true;
    li.dataset.id = String(t.id);
    li.innerHTML = `
      <span class="grip">⠿</span>
      <span class="id">#${i + 1}</span>
      <span class="box">${t.done ? "[x]" : "[ ]"}</span>
      <span class="text"></span>
    `;
    (li.querySelector(".text") as HTMLElement).textContent = t.text;
    attachDnD(li, t.id);
    $list.appendChild(li);
  });
  const open = todos.filter((t) => !t.done).length;
  $count.textContent = `${open} open · ${todos.length} total`;
}

// ---- drag & drop reordering ----
function attachDnD(li: HTMLLIElement, id: number): void {
  li.addEventListener("dragstart", (e) => {
    dragId = id;
    li.classList.add("dragging");
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  });
  li.addEventListener("dragend", () => {
    dragId = null;
    lastDragEnd = Date.now();
    render();
  });
  // single click toggles done (drag is handled above; ignore the click that
  // may fire right after a drag)
  li.addEventListener("click", () => {
    if (Date.now() - lastDragEnd < 200) return;
    toggleById(id);
  });
  li.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    const rect = li.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    li.classList.toggle("drop-after", after);
    li.classList.toggle("drop-before", !after);
  });
  li.addEventListener("dragleave", () => {
    li.classList.remove("drop-before", "drop-after");
  });
  li.addEventListener("drop", (e) => {
    e.preventDefault();
    const rect = li.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    reorderTodos(dragId, id, after ? "after" : "before");
  });
}

function toggleById(id: number): void {
  const idx = todos.findIndex((t) => t.id === id);
  if (idx === -1) return;
  todos[idx].done = !todos[idx].done;
  persist();
  render();
}

function reorderTodos(
  srcId: number | null,
  targetId: number,
  place: DropPlace
): void {
  if (srcId == null || srcId === targetId) return;
  const from = todos.findIndex((t) => t.id === srcId);
  if (from === -1) return;
  const [moved] = todos.splice(from, 1);
  let to = todos.findIndex((t) => t.id === targetId);
  if (to === -1) to = todos.length;
  else if (place === "after") to += 1;
  todos.splice(to, 0, moved);
  persist();
  render();
}

function log(msg: string, type: LogType = "info"): void {
  const line = document.createElement("div");
  line.className = "logline " + type;
  line.textContent = msg;
  $log.appendChild(line);
  scrollBottom();
}
function scrollBottom(): void {
  // the command output is its own scroll pane now
  $log.scrollTop = $log.scrollHeight;
}

// ---- console text theming (/input-color, /output-color, /theme-init) ----
const THEME: Record<string, string> = {
  "--c-cmd": "todoru.cmdColor", // command echo (❯ …) color
  "--c-answer": "todoru.answerColor", // answer / result color
};

function setThemeColor(varName: string, value: string): void {
  const v = value.trim();
  if (!v) return log("usage: <color>  e.g. #4ade80 / rgb(…) / red", "err");
  if (!CSS.supports("color", v)) return log(`invalid color: ${v}`, "err");
  document.documentElement.style.setProperty(varName, v);
  localStorage.setItem(THEME[varName], v);
  log(`${varName === "--c-cmd" ? "text" : "answer"} color → ${v}`, "ok");
}

function resetTheme(): void {
  for (const [varName, key] of Object.entries(THEME)) {
    document.documentElement.style.removeProperty(varName);
    localStorage.removeItem(key);
  }
  log("theme reset to defaults", "ok");
}

function loadTheme(): void {
  for (const [varName, key] of Object.entries(THEME)) {
    const v = localStorage.getItem(key);
    if (v) document.documentElement.style.setProperty(varName, v);
  }
}

// ---- console show / hide (/console-open, /console-close) ----
function setConsole(open: boolean): void {
  $log.classList.toggle("closed", !open);
  localStorage.setItem("todoru.consoleClosed", open ? "0" : "1");
  if (open) {
    log("console opened", "ok");
    scrollBottom();
  }
}

function loadConsoleState(): void {
  if (localStorage.getItem("todoru.consoleClosed") === "1")
    $log.classList.add("closed");
}

// ---- pin to all desktops (/pin) ----
// When on, the window shows on every desktop (Space) and follows you when you
// switch — like the screenshot preview thumbnail. When off, it stays on the
// desktop it was opened on. Default: off.
function applyPin(enabled: boolean, announce: boolean): void {
  window.api.setPin(enabled);
  localStorage.setItem("todoru.pinAllDesktops", enabled ? "1" : "0");
  if (announce)
    log(
      enabled
        ? "pin on · 모든 데스크톱에 표시 (화면 전환 시 따라다님)"
        : "pin off · 이 데스크톱에만 표시",
      "ok"
    );
}

function loadPinState(): void {
  applyPin(localStorage.getItem("todoru.pinAllDesktops") === "1", false);
}

// the number shown to the user (#1, #2 …) is the 1-based position in the list,
// so it always matches the on-screen order after drag & drop.
function findIndex(numRaw: string | undefined): number {
  const n = parseInt(String(numRaw).replace("#", ""), 10);
  if (Number.isNaN(n)) return -1;
  const idx = n - 1;
  return idx >= 0 && idx < todos.length ? idx : -1;
}
function addTodo(text: string): void {
  const todo: Todo = { id: nextId(), text, done: false, createdAt: Date.now() };
  todos.push(todo);
  persist();
  render();
  log(`added #${todos.length} "${text}"`, "ok");
}

// ---- command registry (single source of truth) ----
const COMMANDS: Command[] = [
  {
    name: "/add",
    args: "<text>",
    desc: "할 일 추가",
    run(rest) {
      if (!rest) return log("usage: /add <text>", "err");
      addTodo(rest);
    },
  },
  {
    name: "/delete",
    aliases: ["/del", "/rm"],
    args: "<n>",
    desc: "할 일 삭제 (n = 목록 번호)",
    run(rest) {
      const idStr = rest.split(/\s+/)[0];
      const idx = findIndex(idStr);
      if (idx === -1) return log(`task ${idStr || "?"} not found`, "err");
      const [removed] = todos.splice(idx, 1);
      persist();
      render();
      log(`deleted "${removed.text}"`, "ok");
    },
  },
  {
    name: "/update",
    aliases: ["/edit"],
    args: "<n> <text>",
    desc: "할 일 내용 수정 (n = 목록 번호)",
    run(rest) {
      const parts = rest.split(/\s+/);
      const idStr = parts.shift();
      const text = parts.join(" ").trim();
      const idx = findIndex(idStr);
      if (idx === -1) return log(`task ${idStr || "?"} not found`, "err");
      if (!text) return log("usage: /update <n> <text>", "err");
      const old = todos[idx].text;
      todos[idx].text = text;
      persist();
      render();
      log(`updated #${idx + 1}: "${old}" → "${text}"`, "ok");
    },
  },
  {
    name: "/done",
    aliases: ["/check"],
    args: "<n>",
    desc: "완료/미완료 토글 (n = 목록 번호)",
    run(rest) {
      const idStr = rest.split(/\s+/)[0];
      const idx = findIndex(idStr);
      if (idx === -1) return log(`task ${idStr || "?"} not found`, "err");
      todos[idx].done = !todos[idx].done;
      persist();
      render();
      log(`#${idx + 1} marked ${todos[idx].done ? "done" : "open"}`, "ok");
    },
  },
  {
    name: "/list",
    aliases: ["/ls"],
    args: "",
    desc: "전체 할 일 출력",
    run() {
      if (todos.length === 0) return log("no tasks yet", "info");
      todos.forEach((t, i) =>
        log(`#${i + 1} ${t.done ? "[x]" : "[ ]"} ${t.text}`, "info")
      );
    },
  },
  {
    name: "/clear",
    aliases: ["/cls"],
    args: "",
    desc: "터미널 화면만 비움 (할 일은 유지)",
    run() {
      $log.innerHTML = "";
    },
  },
  {
    name: "/console-open",
    args: "",
    desc: "콘솔(명령 출력) 열기",
    run() {
      setConsole(true);
    },
  },
  {
    name: "/console-close",
    args: "",
    desc: "콘솔(명령 출력) 닫기",
    run() {
      setConsole(false);
    },
  },
  {
    name: "/pin-on",
    args: "",
    desc: "모든 데스크톱에 따라다니기 켜기",
    run() {
      applyPin(true, true);
    },
  },
  {
    name: "/pin-off",
    args: "",
    desc: "이 데스크톱에만 표시 (따라다니기 끄기)",
    run() {
      applyPin(false, true);
    },
  },
  {
    name: "/delete-all",
    aliases: ["/clear-all", "/reset"],
    args: "",
    desc: "모든 할 일 삭제",
    run() {
      const before = todos.length;
      todos = [];
      persist();
      render();
      log(`deleted all ${before} task(s)`, "ok");
    },
  },
  {
    name: "/input-color",
    aliases: ["/text-color"],
    args: "<color>",
    desc: "내가 친 명령어 색 (예: #60a5fa)",
    run(rest) {
      setThemeColor("--c-cmd", rest);
    },
  },
  {
    name: "/output-color",
    aliases: ["/answer-color"],
    args: "<color>",
    desc: "결과/답변 텍스트 색 (예: #4ade80)",
    run(rest) {
      setThemeColor("--c-answer", rest);
    },
  },
  {
    name: "/theme-init",
    aliases: ["/theme-reset"],
    args: "",
    desc: "콘솔 텍스트 색을 기본값으로 초기화",
    run() {
      resetTheme();
    },
  },
  {
    name: "/help",
    aliases: ["/?", "/commands"],
    args: "",
    desc: "전체 명령어 보기",
    run() {
      log("commands:", "info");
      for (const c of COMMANDS) {
        const sig = `${c.name}${c.args ? " " + c.args : ""}`.padEnd(22);
        const alias =
          c.aliases && c.aliases.length ? `  (${c.aliases.join(", ")})` : "";
        log(`  ${sig}${c.desc}${alias}`, "info");
      }
      log("tip: '/' 만 쳐도 명령어 목록이 떠요 · Tab 자동완성", "info");
    },
  },
];

const CMD_MAP: Record<string, Command> = {};
for (const c of COMMANDS) {
  CMD_MAP[c.name] = c;
  (c.aliases || []).forEach((a) => (CMD_MAP[a] = c));
}

function run(raw: string): void {
  const line = raw.trim();
  if (!line) return;
  log("❯ " + line, "cmd");

  if (!line.startsWith("/")) {
    addTodo(line); // bare text => quick add
    return;
  }

  const space = line.indexOf(" ");
  const cmd = (space === -1 ? line : line.slice(0, space)).toLowerCase();
  const rest = space === -1 ? "" : line.slice(space + 1).trim();

  const c = CMD_MAP[cmd];
  if (!c) return log(`unknown command: ${cmd} (try /help)`, "err");
  c.run(rest);
}

// ---- command autocomplete palette ----
interface SuggestState {
  items: Command[];
  index: number;
  open: boolean;
}
const sg: SuggestState = { items: [], index: 0, open: false };

function matchCommands(prefix: string): Command[] {
  const p = prefix.toLowerCase();
  const out: Command[] = [];
  for (const c of COMMANDS) {
    const names = [c.name, ...(c.aliases || [])];
    if (names.some((n) => n.startsWith(p))) out.push(c);
  }
  return out;
}

function updateSuggest(): void {
  const v = $input.value;
  // only while typing the command token (starts with "/", no space yet)
  if (v.startsWith("/") && !v.includes(" ")) {
    const items = matchCommands(v);
    if (items.length) return showSuggest(items);
  }
  hideSuggest();
}

function showSuggest(items: Command[]): void {
  sg.items = items;
  if (sg.index >= items.length) sg.index = 0;
  sg.open = true;
  $suggest.innerHTML = "";
  let activeRow: HTMLElement | null = null;
  items.forEach((c, i) => {
    const row = document.createElement("div");
    row.className = "sg-item" + (i === sg.index ? " active" : "");
    if (i === sg.index) activeRow = row;
    const alias =
      c.aliases && c.aliases.length ? ` · ${c.aliases.join(" ")}` : "";
    row.innerHTML = `
      <span class="sg-name"></span>
      <span class="sg-args"></span>
      <span class="sg-desc"></span>
    `;
    (row.querySelector(".sg-name") as HTMLElement).textContent = c.name;
    (row.querySelector(".sg-args") as HTMLElement).textContent = c.args || "";
    (row.querySelector(".sg-desc") as HTMLElement).textContent = c.desc + alias;
    row.addEventListener("mousedown", (e) => {
      e.preventDefault();
      acceptSuggest(i);
    });
    $suggest.appendChild(row);
  });
  const foot = document.createElement("div");
  foot.className = "sg-foot";
  foot.textContent = "↑↓ 이동 · Tab 완성 · Enter 실행 · Esc 닫기";
  $suggest.appendChild(foot);
  $suggest.hidden = false;
  // keep the highlighted row visible when the list is tall enough to scroll
  if (activeRow) (activeRow as HTMLElement).scrollIntoView({ block: "nearest" });
}

function hideSuggest(): void {
  sg.open = false;
  sg.index = 0;
  $suggest.hidden = true;
}

function moveSuggest(delta: number): void {
  if (!sg.items.length) return;
  sg.index = (sg.index + delta + sg.items.length) % sg.items.length;
  showSuggest(sg.items);
}

function acceptSuggest(i: number = sg.index): void {
  const c = sg.items[i];
  if (!c) return;
  // fill the command name; add a trailing space so args can follow
  $input.value = c.name + " ";
  hideSuggest();
  $input.focus();
}

// ---- input handling ----
$input.addEventListener("input", updateSuggest);

$input.addEventListener("keydown", (e) => {
  // ignore Enter while an IME (Korean) is still composing -> avoids double run
  if (e.isComposing || e.keyCode === 229) return;

  // ----- palette is open: arrows/tab/enter/esc drive it -----
  if (sg.open && sg.items.length) {
    if (e.key === "ArrowUp") return (e.preventDefault(), moveSuggest(-1));
    if (e.key === "ArrowDown") return (e.preventDefault(), moveSuggest(1));
    if (e.key === "Tab") return (e.preventDefault(), acceptSuggest());
    if (e.key === "Escape") return (e.preventDefault(), hideSuggest());
    if (e.key === "Enter") {
      e.preventDefault();
      const c = sg.items[sg.index];
      if (c.args) {
        // needs arguments -> just complete it, let the user type the args
        acceptSuggest();
      } else {
        // no arguments -> run the highlighted command right away
        hideSuggest();
        $input.value = "";
        cmdHistory.push(c.name);
        historyIdx = cmdHistory.length;
        run(c.name);
      }
      return;
    }
  }

  if (e.key === "Enter") {
    const val = $input.value;
    hideSuggest();
    if (val.trim()) {
      cmdHistory.push(val);
      historyIdx = cmdHistory.length;
      run(val);
    }
    $input.value = "";
  } else if (e.key === "ArrowUp") {
    if (cmdHistory.length && historyIdx > 0) {
      historyIdx--;
      $input.value = cmdHistory[historyIdx];
      e.preventDefault();
    }
  } else if (e.key === "ArrowDown") {
    if (historyIdx < cmdHistory.length - 1) {
      historyIdx++;
      $input.value = cmdHistory[historyIdx];
    } else {
      historyIdx = cmdHistory.length;
      $input.value = "";
    }
    e.preventDefault();
  }
});

// keep focus on the input
document.addEventListener("click", () => $input.focus());

// ---- titlebar buttons ----
(document.getElementById("btn-close") as HTMLElement).addEventListener(
  "click",
  () => window.api.closeWindow()
);
(document.getElementById("btn-min") as HTMLElement).addEventListener(
  "click",
  () => window.api.minimizeWindow()
);

// ---- boot ----
loadTheme();
loadConsoleState();
loadPinState();
load();
$input.focus();
