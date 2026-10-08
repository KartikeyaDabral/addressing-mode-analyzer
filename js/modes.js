// Each mode says what the operand field means and how the CPU resolves it.
// resolve() returns trace steps, effective address (ea), value, and the memory cells touched.
const mk = (s, ea, steps, touches, reg) => ({ steps, ea, val: s.mem[ea], touches, reg });
const fetchSteps = (a, s) => [`Read memory[${a}].`, `Value = ${s.mem[a]}.`];
const bad = (a, steps, touches, reg) => ({ error: `Address ${a} is outside memory (0 to 31).`, steps, touches, reg });

const MODES = {
  immediate: {
    name: "Immediate", label: "Constant value", desc: "The operand is part of the instruction itself. No memory access is needed.",
    syntax: (o) => `LOAD R0, #${o}`, uses: "Constants and loop counters", accesses: 0, speed: "Fastest", ea: "none",
    resolve: (o) => ({ steps: [`The constant ${o} is stored inside the instruction.`, `Value = ${o}. No address is calculated.`], ea: null, val: o, touches: [] })
  },
  register: {
    name: "Register", label: "Not used", needsReg: true, noOperand: true, desc: "The operand sits in a CPU register named by the instruction.",
    syntax: (o, r) => `LOAD R0, ${r}`, uses: "Temporary values and results", accesses: 0, speed: "Very fast", ea: "none",
    resolve: (o, r, s) => ({ steps: [`Read register ${r}.`, `Value = ${s.regs[r]}. Memory is not touched.`], ea: null, val: s.regs[r], touches: [], reg: [r] })
  },
  direct: {
    name: "Direct (absolute)", label: "Memory address", desc: "The instruction holds the memory address of the operand.",
    syntax: (o) => `LOAD R0, [${o}]`, uses: "Global and static variables", accesses: 1, speed: "Medium", ea: "A",
    resolve: (o, r, s) => mk(s, o, [`Effective address = ${o}, taken straight from the instruction.`, ...fetchSteps(o, s)], [[o, "c"]])
  },
  indirect: {
    name: "Indirect", label: "Address of pointer", desc: "The instruction holds the address of a memory cell, and that cell holds the address of the operand.",
    syntax: (o) => `LOAD R0, [[${o}]]`, uses: "Pointers and jump tables", accesses: 2, speed: "Slow", ea: "M[A]",
    resolve: (o, r, s, ok) => {
      const p = s.mem[o], steps = [`Read memory[${o}] to get the pointer: ${p}.`, `Effective address = ${p}.`];
      if (!ok(p)) return bad(p, steps, [[o, "b"]]);
      return mk(s, p, [...steps, ...fetchSteps(p, s)], [[o, "b"], [p, "c"]]);
    }
  },
  regind: {
    name: "Register indirect", label: "Not used", needsReg: true, noOperand: true, desc: "A register holds the address of the operand.",
    syntax: (o, r) => `LOAD R0, [${r}]`, uses: "Pointer walking, stack access", accesses: 1, speed: "Fast", ea: "Rn",
    resolve: (o, r, s, ok) => {
      const a = s.regs[r], steps = [`Read ${r}: ${a}.`, `Effective address = ${a}.`];
      if (!ok(a)) return bad(a, steps, [], [r]);
      return mk(s, a, [...steps, ...fetchSteps(a, s)], [[a, "c"]], [r]);
    }
  },
  indexed: {
    name: "Indexed", label: "Base address", needsReg: true, desc: "Effective address = the address in the instruction + the index register.",
    syntax: (o, r) => `LOAD R0, [${o} + ${r}]`, uses: "Arrays and tables", accesses: 1, speed: "Medium", ea: "A + Rn",
    resolve: (o, r, s, ok) => {
      const a = o + s.regs[r], steps = [`Read index register ${r}: ${s.regs[r]}.`, `Effective address = ${o} + ${s.regs[r]} = ${a}.`];
      if (!ok(a)) return bad(a, steps, [], [r]);
      return mk(s, a, [...steps, ...fetchSteps(a, s)], [[a, "c"]], [r]);
    }
  },
  relative: {
    name: "PC-relative", label: "Offset (can be negative)", desc: "Effective address = the program counter + a signed offset.",
    syntax: (o) => `LOAD R0, [PC ${o < 0 ? "-" : "+"} ${Math.abs(o)}]`, uses: "Branches and position-independent code", accesses: 1, speed: "Medium", ea: "PC + offset",
    resolve: (o, r, s, ok) => {
      const a = s.regs.PC + o, steps = [`PC = ${s.regs.PC}.`, `Effective address = ${s.regs.PC} + (${o}) = ${a}.`];
      if (!ok(a)) return bad(a, steps, [], ["PC"]);
      return mk(s, a, [...steps, ...fetchSteps(a, s)], [[a, "c"]], ["PC"]);
    }
  },
  base: {
    name: "Base register", label: "Offset", desc: "Effective address = the base register + an offset. Moving the base relocates a whole block of data.",
    syntax: (o) => `LOAD R0, [BASE + ${o}]`, uses: "Relocation and segmented memory", accesses: 1, speed: "Medium", ea: "BASE + offset",
    resolve: (o, r, s, ok) => {
      const a = s.regs.BASE + o, steps = [`BASE = ${s.regs.BASE}.`, `Effective address = ${s.regs.BASE} + ${o} = ${a}.`];
      if (!ok(a)) return bad(a, steps, [], ["BASE"]);
      return mk(s, a, [...steps, ...fetchSteps(a, s)], [[a, "c"]], ["BASE"]);
    }
  }
};
