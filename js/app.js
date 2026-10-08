const MEM_SIZE = 32;
const DEFAULT_REGS = { R0: 0, R1: 4, R2: 2, R3: 10, PC: 12, BASE: 16 };
const DEFAULT_MEM = [7,15,22,9,31,18,40,3, 12,25,6,19,50,8,27,14, 11,33,5,21,17,60,2,45, 9,28,13,36,4,23,30,1];

const $ = (id) => document.getElementById(id);
let state = fresh();
let hit = { mem: {}, reg: [] };

function fresh() { return { regs: { ...DEFAULT_REGS }, mem: [...DEFAULT_MEM] }; }
const inRange = (a) => Number.isInteger(a) && a >= 0 && a < MEM_SIZE;

function init() {
  $("mode").innerHTML = Object.entries(MODES).map(([k, m]) => `<option value="${k}">${m.name}</option>`).join("");
  $("cmp").innerHTML = `<tr><th>Mode</th><th>Effective address</th><th>Memory accesses</th><th>Speed</th><th>Typical use</th></tr>` +
    Object.entries(MODES).map(([k, m]) => `<tr data-k="${k}"><td>${m.name}</td><td class="mono">${m.ea}</td><td>${m.accesses}</td><td>${m.speed}</td><td>${m.uses}</td></tr>`).join("");
  ["mode", "operand", "reg"].forEach((id) => $(id).addEventListener("input", updateForm));
  $("run").addEventListener("click", run);
  $("reset").addEventListener("click", () => { state = fresh(); run(); });
  updateForm(); run();
}

function updateForm() {
  const m = MODES[$("mode").value];
  $("mode-desc").textContent = m.desc;
  $("operand-label").textContent = m.label;
  $("operand").disabled = !!m.noOperand;
  $("reg-wrap").style.display = m.needsReg ? "block" : "none";
  $("asm").textContent = m.syntax(parseInt($("operand").value, 10) || 0, $("reg").value);
  document.querySelectorAll("#cmp tr[data-k]").forEach((tr) => tr.classList.toggle("cur", tr.dataset.k === $("mode").value));
}

function run() {
  updateForm();
  const key = $("mode").value, m = MODES[key];
  const o = parseInt($("operand").value, 10) || 0;
  const res = ["direct", "indirect"].includes(key) && !inRange(o)
    ? { error: `Address ${o} is outside memory (0 to 31).`, steps: [], touches: [] }
    : m.resolve(o, $("reg").value, state, inRange);

  $("trace").innerHTML = res.steps.map((s) => `<li>${s}</li>`).join("") + (res.error ? `<li class="err">${res.error} The access is rejected.</li>` : "");
  const none = res.ea === null || res.ea === undefined;
  $("r-ea").textContent = res.error ? "invalid" : none ? "none" : res.ea;
  $("r-val").textContent = res.error ? "-" : res.val;
  $("r-acc").textContent = res.error ? "-" : res.touches.length;

  hit = { mem: {}, reg: res.reg || [] };
  res.touches.forEach(([a, cls]) => (hit.mem[a] = cls));
  if (!none && !res.error) hit.mem[res.ea] = hit.mem[res.ea] || "a";
  render();
}

function render() {
  $("regs").innerHTML = Object.entries(state.regs).map(([k, v]) =>
    `<div class="${hit.reg.includes(k) ? "hit" : ""}"><span>${k}</span><input type="number" data-r="${k}" value="${v}" aria-label="Register ${k}"></div>`).join("");
  $("mem").innerHTML = state.mem.map((v, i) =>
    `<div class="${hit.mem[i] || ""}"><small>${i}</small><input type="number" data-m="${i}" value="${v}" aria-label="Memory address ${i}"></div>`).join("");
  document.querySelectorAll("[data-r]").forEach((e) => e.addEventListener("change", () => { state.regs[e.dataset.r] = parseInt(e.value, 10) || 0; }));
  document.querySelectorAll("[data-m]").forEach((e) => e.addEventListener("change", () => { state.mem[e.dataset.m] = parseInt(e.value, 10) || 0; }));
}

init();
