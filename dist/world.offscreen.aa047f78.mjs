var a = Object.defineProperty;
var J = (m, l, Z) => l in m ? a(m, l, { enumerable: !0, configurable: !0, writable: !0, value: Z }) : m[l] = Z;
var G = (m, l, Z) => (J(m, typeof l != "symbol" ? l + "" : l, Z), Z), R = (m, l, Z) => {
  if (!l.has(m))
    throw TypeError("Cannot " + Z);
};
var b = (m, l, Z) => (R(m, l, "read from private field"), Z ? Z.call(m) : l.get(m)), c = (m, l, Z) => {
  if (l.has(m))
    throw TypeError("Cannot add the same private member more than once");
  l instanceof WeakSet ? l.add(m) : l.set(m, Z);
}, u = (m, l, Z, V) => (R(m, l, "write to private field"), V ? V.call(m, Z) : l.set(m, Z), Z);
var h = (m, l, Z) => (R(m, l, "access private method"), Z);
function L() {
  const m = Y && (window.URL || window.webkitURL).createObjectURL(Y);
  try {
    return m ? new Worker(m) : new Worker("data:application/javascript;base64," + y);
  } finally {
    m && (window.URL || window.webkitURL).revokeObjectURL(m);
  }
}
var X, d, W, p;
class F {
  constructor(l) {
    c(this, W);
    G(this, "initialized", !1);
    G(this, "offscreenWorkerInit", !1);
    G(this, "themeLoadedInit", !1);
    G(this, "pendingThemePromises", {});
    c(this, X, void 0);
    c(this, d, void 0);
    G(this, "onRollResult", () => {
    });
    G(this, "onRollComplete", () => {
    });
    this.onInitComplete = l.onInitComplete, u(this, X, l.canvas.transferControlToOffscreen()), u(this, d, new L()), b(this, d).init = new Promise((Z, V) => {
      this.offscreenWorkerInit = Z;
    }), this.initialized = h(this, W, p).call(this, l);
  }
  connect(l) {
    b(this, d).postMessage({
      action: "connect",
      port: l
    }, [l]);
  }
  updateConfig(l) {
    b(this, d).postMessage({ action: "updateConfig", options: l });
  }
  resize(l) {
    b(this, d).postMessage({ action: "resize", options: l });
  }
  async loadTheme(l) {
    return new Promise((Z, V) => {
      if (Object.keys(this.pendingThemePromises).includes(l.theme))
        return Z();
      this.pendingThemePromises[l.theme] = Z, b(this, d).postMessage({ action: "loadTheme", options: l });
    }).catch((Z) => console.error(Z));
  }
  clear() {
    b(this, d).postMessage({ action: "clearDice" });
  }
  add(l) {
    b(this, d).postMessage({ action: "addDie", options: l });
  }
  addNonDie(l) {
    b(this, d).postMessage({ action: "addNonDie", options: l });
  }
  remove(l) {
    b(this, d).postMessage({ action: "removeDie", options: l });
  }
}
X = new WeakMap(), d = new WeakMap(), W = new WeakSet(), p = async function(l) {
  return b(this, d).postMessage({
    action: "init",
    canvas: b(this, X),
    width: l.canvas.clientWidth,
    height: l.canvas.clientHeight,
    options: l.options
  }, [b(this, X)]), b(this, d).onmessage = (Z) => {
    switch (Z.data.action) {
      case "init-complete":
        this.offscreenWorkerInit();
        break;
      case "connect-complete":
        break;
      case "theme-loaded":
        Z.data.id && this.pendingThemePromises[Z.data.id](Z.data.id);
        break;
      case "roll-result":
        this.onRollResult(Z.data.die);
        break;
      case "roll-complete":
        this.onRollComplete();
        break;
      case "die-removed":
        this.onDieRemoved(Z.data.rollId);
        break;
    }
  }, await b(this, d).init, this.onInitComplete(!0), !0;
};
export {
  F as default
};