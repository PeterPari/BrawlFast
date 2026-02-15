var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/build/index.js
import { WorkerEntrypoint as lt } from "cloudflare:workers";
import X from "./c77f7c0ebe68796a018afeac3607bbd08f9ef7a2-index_bg.wasm";
var F = class {
  static {
    __name(this, "F");
  }
  __destroy_into_raw() {
    let t = this.__wbg_ptr;
    return this.__wbg_ptr = 0, _t.unregister(this), t;
  }
  free() {
    let t = this.__destroy_into_raw();
    s.__wbg_containerstartupoptions_free(t, 0);
  }
  get enableInternet() {
    if (this.__wbg_inst !== void 0 && this.__wbg_inst !== c) throw new Error("Invalid stale object from previous Wasm instance");
    let t = s.__wbg_get_containerstartupoptions_enableInternet(this.__wbg_ptr);
    return t === 16777215 ? void 0 : t !== 0;
  }
  get entrypoint() {
    try {
      if (this.__wbg_inst !== void 0 && this.__wbg_inst !== c) throw new Error("Invalid stale object from previous Wasm instance");
      let o = s.__wbindgen_add_to_stack_pointer(-16);
      s.__wbg_get_containerstartupoptions_entrypoint(o, this.__wbg_ptr);
      var t = f().getInt32(o + 0, true), e = f().getInt32(o + 4, true), n = ft(t, e).slice();
      return s.__wbindgen_export4(t, e * 4, 4), n;
    } finally {
      s.__wbindgen_add_to_stack_pointer(16);
    }
  }
  get env() {
    if (this.__wbg_inst !== void 0 && this.__wbg_inst !== c) throw new Error("Invalid stale object from previous Wasm instance");
    let t = s.__wbg_get_containerstartupoptions_env(this.__wbg_ptr);
    return l(t);
  }
  set enableInternet(t) {
    if (this.__wbg_inst !== void 0 && this.__wbg_inst !== c) throw new Error("Invalid stale object from previous Wasm instance");
    s.__wbg_set_containerstartupoptions_enableInternet(this.__wbg_ptr, g(t) ? 16777215 : t ? 1 : 0);
  }
  set entrypoint(t) {
    if (this.__wbg_inst !== void 0 && this.__wbg_inst !== c) throw new Error("Invalid stale object from previous Wasm instance");
    let e = bt(t, s.__wbindgen_export), n = p;
    s.__wbg_set_containerstartupoptions_entrypoint(this.__wbg_ptr, e, n);
  }
  set env(t) {
    if (this.__wbg_inst !== void 0 && this.__wbg_inst !== c) throw new Error("Invalid stale object from previous Wasm instance");
    s.__wbg_set_containerstartupoptions_env(this.__wbg_ptr, i(t));
  }
};
Symbol.dispose && (F.prototype[Symbol.dispose] = F.prototype.free);
var E = class {
  static {
    __name(this, "E");
  }
  __destroy_into_raw() {
    let t = this.__wbg_ptr;
    return this.__wbg_ptr = 0, ot.unregister(this), t;
  }
  free() {
    let t = this.__destroy_into_raw();
    s.__wbg_intounderlyingbytesource_free(t, 0);
  }
  get autoAllocateChunkSize() {
    if (this.__wbg_inst !== void 0 && this.__wbg_inst !== c) throw new Error("Invalid stale object from previous Wasm instance");
    return s.intounderlyingbytesource_autoAllocateChunkSize(this.__wbg_ptr) >>> 0;
  }
  cancel() {
    if (this.__wbg_inst !== void 0 && this.__wbg_inst !== c) throw new Error("Invalid stale object from previous Wasm instance");
    let t = this.__destroy_into_raw();
    s.intounderlyingbytesource_cancel(t);
  }
  pull(t) {
    if (this.__wbg_inst !== void 0 && this.__wbg_inst !== c) throw new Error("Invalid stale object from previous Wasm instance");
    let e = s.intounderlyingbytesource_pull(this.__wbg_ptr, i(t));
    return l(e);
  }
  start(t) {
    if (this.__wbg_inst !== void 0 && this.__wbg_inst !== c) throw new Error("Invalid stale object from previous Wasm instance");
    s.intounderlyingbytesource_start(this.__wbg_ptr, i(t));
  }
  get type() {
    if (this.__wbg_inst !== void 0 && this.__wbg_inst !== c) throw new Error("Invalid stale object from previous Wasm instance");
    let t = s.intounderlyingbytesource_type(this.__wbg_ptr);
    return et[t];
  }
};
Symbol.dispose && (E.prototype[Symbol.dispose] = E.prototype.free);
var j = class {
  static {
    __name(this, "j");
  }
  __destroy_into_raw() {
    let t = this.__wbg_ptr;
    return this.__wbg_ptr = 0, it.unregister(this), t;
  }
  free() {
    let t = this.__destroy_into_raw();
    s.__wbg_intounderlyingsink_free(t, 0);
  }
  abort(t) {
    if (this.__wbg_inst !== void 0 && this.__wbg_inst !== c) throw new Error("Invalid stale object from previous Wasm instance");
    let e = this.__destroy_into_raw(), n = s.intounderlyingsink_abort(e, i(t));
    return l(n);
  }
  close() {
    if (this.__wbg_inst !== void 0 && this.__wbg_inst !== c) throw new Error("Invalid stale object from previous Wasm instance");
    let t = this.__destroy_into_raw(), e = s.intounderlyingsink_close(t);
    return l(e);
  }
  write(t) {
    if (this.__wbg_inst !== void 0 && this.__wbg_inst !== c) throw new Error("Invalid stale object from previous Wasm instance");
    let e = s.intounderlyingsink_write(this.__wbg_ptr, i(t));
    return l(e);
  }
};
Symbol.dispose && (j.prototype[Symbol.dispose] = j.prototype.free);
var S = class {
  static {
    __name(this, "S");
  }
  __destroy_into_raw() {
    let t = this.__wbg_ptr;
    return this.__wbg_ptr = 0, st.unregister(this), t;
  }
  free() {
    let t = this.__destroy_into_raw();
    s.__wbg_intounderlyingsource_free(t, 0);
  }
  cancel() {
    if (this.__wbg_inst !== void 0 && this.__wbg_inst !== c) throw new Error("Invalid stale object from previous Wasm instance");
    let t = this.__destroy_into_raw();
    s.intounderlyingsource_cancel(t);
  }
  pull(t) {
    if (this.__wbg_inst !== void 0 && this.__wbg_inst !== c) throw new Error("Invalid stale object from previous Wasm instance");
    let e = s.intounderlyingsource_pull(this.__wbg_ptr, i(t));
    return l(e);
  }
};
Symbol.dispose && (S.prototype[Symbol.dispose] = S.prototype.free);
var I = class _ {
  static {
    __name(this, "_");
  }
  static __wrap(t) {
    t = t >>> 0;
    let e = Object.create(_.prototype);
    return e.__wbg_ptr = t, e.__wbg_inst = c, H.register(e, { ptr: t, instance: c }, e), e;
  }
  __destroy_into_raw() {
    let t = this.__wbg_ptr;
    return this.__wbg_ptr = 0, H.unregister(this), t;
  }
  free() {
    let t = this.__destroy_into_raw();
    s.__wbg_minifyconfig_free(t, 0);
  }
  get css() {
    if (this.__wbg_inst !== void 0 && this.__wbg_inst !== c) throw new Error("Invalid stale object from previous Wasm instance");
    return s.__wbg_get_minifyconfig_css(this.__wbg_ptr) !== 0;
  }
  get html() {
    if (this.__wbg_inst !== void 0 && this.__wbg_inst !== c) throw new Error("Invalid stale object from previous Wasm instance");
    return s.__wbg_get_minifyconfig_html(this.__wbg_ptr) !== 0;
  }
  get js() {
    if (this.__wbg_inst !== void 0 && this.__wbg_inst !== c) throw new Error("Invalid stale object from previous Wasm instance");
    return s.__wbg_get_minifyconfig_js(this.__wbg_ptr) !== 0;
  }
  set css(t) {
    if (this.__wbg_inst !== void 0 && this.__wbg_inst !== c) throw new Error("Invalid stale object from previous Wasm instance");
    s.__wbg_set_minifyconfig_css(this.__wbg_ptr, t);
  }
  set html(t) {
    if (this.__wbg_inst !== void 0 && this.__wbg_inst !== c) throw new Error("Invalid stale object from previous Wasm instance");
    s.__wbg_set_minifyconfig_html(this.__wbg_ptr, t);
  }
  set js(t) {
    if (this.__wbg_inst !== void 0 && this.__wbg_inst !== c) throw new Error("Invalid stale object from previous Wasm instance");
    s.__wbg_set_minifyconfig_js(this.__wbg_ptr, t);
  }
};
Symbol.dispose && (I.prototype[Symbol.dispose] = I.prototype.free);
var k = class {
  static {
    __name(this, "k");
  }
  __destroy_into_raw() {
    let t = this.__wbg_ptr;
    return this.__wbg_ptr = 0, ct.unregister(this), t;
  }
  free() {
    let t = this.__destroy_into_raw();
    s.__wbg_r2range_free(t, 0);
  }
  get length() {
    try {
      if (this.__wbg_inst !== void 0 && this.__wbg_inst !== c) throw new Error("Invalid stale object from previous Wasm instance");
      let n = s.__wbindgen_add_to_stack_pointer(-16);
      s.__wbg_get_r2range_length(n, this.__wbg_ptr);
      var t = f().getInt32(n + 0, true), e = f().getFloat64(n + 8, true);
      return t === 0 ? void 0 : e;
    } finally {
      s.__wbindgen_add_to_stack_pointer(16);
    }
  }
  get offset() {
    try {
      if (this.__wbg_inst !== void 0 && this.__wbg_inst !== c) throw new Error("Invalid stale object from previous Wasm instance");
      let n = s.__wbindgen_add_to_stack_pointer(-16);
      s.__wbg_get_r2range_offset(n, this.__wbg_ptr);
      var t = f().getInt32(n + 0, true), e = f().getFloat64(n + 8, true);
      return t === 0 ? void 0 : e;
    } finally {
      s.__wbindgen_add_to_stack_pointer(16);
    }
  }
  get suffix() {
    try {
      if (this.__wbg_inst !== void 0 && this.__wbg_inst !== c) throw new Error("Invalid stale object from previous Wasm instance");
      let n = s.__wbindgen_add_to_stack_pointer(-16);
      s.__wbg_get_r2range_suffix(n, this.__wbg_ptr);
      var t = f().getInt32(n + 0, true), e = f().getFloat64(n + 8, true);
      return t === 0 ? void 0 : e;
    } finally {
      s.__wbindgen_add_to_stack_pointer(16);
    }
  }
  set length(t) {
    if (this.__wbg_inst !== void 0 && this.__wbg_inst !== c) throw new Error("Invalid stale object from previous Wasm instance");
    s.__wbg_set_r2range_length(this.__wbg_ptr, !g(t), g(t) ? 0 : t);
  }
  set offset(t) {
    if (this.__wbg_inst !== void 0 && this.__wbg_inst !== c) throw new Error("Invalid stale object from previous Wasm instance");
    s.__wbg_set_r2range_offset(this.__wbg_ptr, !g(t), g(t) ? 0 : t);
  }
  set suffix(t) {
    if (this.__wbg_inst !== void 0 && this.__wbg_inst !== c) throw new Error("Invalid stale object from previous Wasm instance");
    s.__wbg_set_r2range_suffix(this.__wbg_ptr, !g(t), g(t) ? 0 : t);
  }
};
Symbol.dispose && (k.prototype[Symbol.dispose] = k.prototype.free);
function V() {
  c++, x = null, A = null, typeof numBytesDecoded < "u" && (numBytesDecoded = 0), typeof p < "u" && (p = 0), typeof w < "u" && (w = new Array(128).fill(void 0), w = w.concat([void 0, null, true, false]), typeof v < "u" && (v = w.length)), s = new WebAssembly.Instance(X, K()).exports, s.__wbindgen_start();
}
__name(V, "V");
function J(_2, t, e) {
  let n = s.fetch(i(_2), i(t), i(e));
  return l(n);
}
__name(J, "J");
function G(_2, t, e) {
  let n = s.scheduled(i(_2), i(t), i(e));
  return l(n);
}
__name(G, "G");
function q(_2) {
  s.setPanicHook(i(_2));
}
__name(q, "q");
function K() {
  return { __proto__: null, "./index_bg.js": { __proto__: null, __wbg_Error_8c4e43fe74559d73: /* @__PURE__ */ __name(function(t, e) {
    let n = Error(y(t, e));
    return i(n);
  }, "__wbg_Error_8c4e43fe74559d73"), __wbg_Number_04624de7d0e8332d: /* @__PURE__ */ __name(function(t) {
    return Number(r(t));
  }, "__wbg_Number_04624de7d0e8332d"), __wbg_String_8f0eb39a4a4c2f66: /* @__PURE__ */ __name(function(t, e) {
    let n = String(r(e)), o = m(n, s.__wbindgen_export, s.__wbindgen_export2), u = p;
    f().setInt32(t + 4, u, true), f().setInt32(t + 0, o, true);
  }, "__wbg_String_8f0eb39a4a4c2f66"), __wbg___wbindgen_bigint_get_as_i64_8fcf4ce7f1ca72a2: /* @__PURE__ */ __name(function(t, e) {
    let n = r(e), o = typeof n == "bigint" ? n : void 0;
    f().setBigInt64(t + 8, g(o) ? BigInt(0) : o, true), f().setInt32(t + 0, !g(o), true);
  }, "__wbg___wbindgen_bigint_get_as_i64_8fcf4ce7f1ca72a2"), __wbg___wbindgen_boolean_get_bbbb1c18aa2f5e25: /* @__PURE__ */ __name(function(t) {
    let e = r(t), n = typeof e == "boolean" ? e : void 0;
    return g(n) ? 16777215 : n ? 1 : 0;
  }, "__wbg___wbindgen_boolean_get_bbbb1c18aa2f5e25"), __wbg___wbindgen_debug_string_0bc8482c6e3508ae: /* @__PURE__ */ __name(function(t, e) {
    let n = L(r(e)), o = m(n, s.__wbindgen_export, s.__wbindgen_export2), u = p;
    f().setInt32(t + 4, u, true), f().setInt32(t + 0, o, true);
  }, "__wbg___wbindgen_debug_string_0bc8482c6e3508ae"), __wbg___wbindgen_in_47fa6863be6f2f25: /* @__PURE__ */ __name(function(t, e) {
    return r(t) in r(e);
  }, "__wbg___wbindgen_in_47fa6863be6f2f25"), __wbg___wbindgen_is_bigint_31b12575b56f32fc: /* @__PURE__ */ __name(function(t) {
    return typeof r(t) == "bigint";
  }, "__wbg___wbindgen_is_bigint_31b12575b56f32fc"), __wbg___wbindgen_is_function_0095a73b8b156f76: /* @__PURE__ */ __name(function(t) {
    return typeof r(t) == "function";
  }, "__wbg___wbindgen_is_function_0095a73b8b156f76"), __wbg___wbindgen_is_null_ac34f5003991759a: /* @__PURE__ */ __name(function(t) {
    return r(t) === null;
  }, "__wbg___wbindgen_is_null_ac34f5003991759a"), __wbg___wbindgen_is_object_5ae8e5880f2c1fbd: /* @__PURE__ */ __name(function(t) {
    let e = r(t);
    return typeof e == "object" && e !== null;
  }, "__wbg___wbindgen_is_object_5ae8e5880f2c1fbd"), __wbg___wbindgen_is_string_cd444516edc5b180: /* @__PURE__ */ __name(function(t) {
    return typeof r(t) == "string";
  }, "__wbg___wbindgen_is_string_cd444516edc5b180"), __wbg___wbindgen_is_undefined_9e4d92534c42d778: /* @__PURE__ */ __name(function(t) {
    return r(t) === void 0;
  }, "__wbg___wbindgen_is_undefined_9e4d92534c42d778"), __wbg___wbindgen_jsval_eq_11888390b0186270: /* @__PURE__ */ __name(function(t, e) {
    return r(t) === r(e);
  }, "__wbg___wbindgen_jsval_eq_11888390b0186270"), __wbg___wbindgen_jsval_loose_eq_9dd77d8cd6671811: /* @__PURE__ */ __name(function(t, e) {
    return r(t) == r(e);
  }, "__wbg___wbindgen_jsval_loose_eq_9dd77d8cd6671811"), __wbg___wbindgen_number_get_8ff4255516ccad3e: /* @__PURE__ */ __name(function(t, e) {
    let n = r(e), o = typeof n == "number" ? n : void 0;
    f().setFloat64(t + 8, g(o) ? 0 : o, true), f().setInt32(t + 0, !g(o), true);
  }, "__wbg___wbindgen_number_get_8ff4255516ccad3e"), __wbg___wbindgen_string_get_72fb696202c56729: /* @__PURE__ */ __name(function(t, e) {
    let n = r(e), o = typeof n == "string" ? n : void 0;
    var u = g(o) ? 0 : m(o, s.__wbindgen_export, s.__wbindgen_export2), a = p;
    f().setInt32(t + 4, a, true), f().setInt32(t + 0, u, true);
  }, "__wbg___wbindgen_string_get_72fb696202c56729"), __wbg___wbindgen_throw_be289d5034ed271b: /* @__PURE__ */ __name(function(t, e) {
    throw new Error(y(t, e));
  }, "__wbg___wbindgen_throw_be289d5034ed271b"), __wbg__wbg_cb_unref_d9b87ff7982e3b21: /* @__PURE__ */ __name(function(t) {
    r(t)._wbg_cb_unref();
  }, "__wbg__wbg_cb_unref_d9b87ff7982e3b21"), __wbg_body_3a0b4437dadea6bf: /* @__PURE__ */ __name(function(t) {
    let e = r(t).body;
    return g(e) ? 0 : i(e);
  }, "__wbg_body_3a0b4437dadea6bf"), __wbg_buffer_26d0910f3a5bc899: /* @__PURE__ */ __name(function(t) {
    let e = r(t).buffer;
    return i(e);
  }, "__wbg_buffer_26d0910f3a5bc899"), __wbg_byobRequest_80e594e6da4e1af7: /* @__PURE__ */ __name(function(t) {
    let e = r(t).byobRequest;
    return g(e) ? 0 : i(e);
  }, "__wbg_byobRequest_80e594e6da4e1af7"), __wbg_byteLength_3417f266f4bf562a: /* @__PURE__ */ __name(function(t) {
    return r(t).byteLength;
  }, "__wbg_byteLength_3417f266f4bf562a"), __wbg_byteOffset_f88547ca47c86358: /* @__PURE__ */ __name(function(t) {
    return r(t).byteOffset;
  }, "__wbg_byteOffset_f88547ca47c86358"), __wbg_call_389efe28435a9388: /* @__PURE__ */ __name(function() {
    return b(function(t, e) {
      let n = r(t).call(r(e));
      return i(n);
    }, arguments);
  }, "__wbg_call_389efe28435a9388"), __wbg_call_4708e0c13bdc8e95: /* @__PURE__ */ __name(function() {
    return b(function(t, e, n) {
      let o = r(t).call(r(e), r(n));
      return i(o);
    }, arguments);
  }, "__wbg_call_4708e0c13bdc8e95"), __wbg_call_812d25f1510c13c8: /* @__PURE__ */ __name(function() {
    return b(function(t, e, n, o) {
      let u = r(t).call(r(e), r(n), r(o));
      return i(u);
    }, arguments);
  }, "__wbg_call_812d25f1510c13c8"), __wbg_call_e8c868596c950cf6: /* @__PURE__ */ __name(function() {
    return b(function(t, e, n, o, u) {
      let a = r(t).call(r(e), r(n), r(o), r(u));
      return i(a);
    }, arguments);
  }, "__wbg_call_e8c868596c950cf6"), __wbg_cancel_2c0a0a251ff6b2b7: /* @__PURE__ */ __name(function(t) {
    let e = r(t).cancel();
    return i(e);
  }, "__wbg_cancel_2c0a0a251ff6b2b7"), __wbg_catch_c1f8c7623b458214: /* @__PURE__ */ __name(function(t, e) {
    let n = r(t).catch(r(e));
    return i(n);
  }, "__wbg_catch_c1f8c7623b458214"), __wbg_cause_0fc168d4eaec87cc: /* @__PURE__ */ __name(function(t) {
    let e = r(t).cause;
    return i(e);
  }, "__wbg_cause_0fc168d4eaec87cc"), __wbg_cf_826be5049e21969d: /* @__PURE__ */ __name(function() {
    return b(function(t) {
      let e = r(t).cf;
      return g(e) ? 0 : i(e);
    }, arguments);
  }, "__wbg_cf_826be5049e21969d"), __wbg_cf_b8165e79377eeebd: /* @__PURE__ */ __name(function() {
    return b(function(t) {
      let e = r(t).cf;
      return g(e) ? 0 : i(e);
    }, arguments);
  }, "__wbg_cf_b8165e79377eeebd"), __wbg_close_06dfa0a815b9d71f: /* @__PURE__ */ __name(function() {
    return b(function(t) {
      r(t).close();
    }, arguments);
  }, "__wbg_close_06dfa0a815b9d71f"), __wbg_close_a79afee31de55b36: /* @__PURE__ */ __name(function() {
    return b(function(t) {
      r(t).close();
    }, arguments);
  }, "__wbg_close_a79afee31de55b36"), __wbg_constructor_ad6c0ed428f55d34: /* @__PURE__ */ __name(function(t) {
    let e = r(t).constructor;
    return i(e);
  }, "__wbg_constructor_ad6c0ed428f55d34"), __wbg_cron_6628fcfb7c02d168: /* @__PURE__ */ __name(function() {
    return b(function(t, e) {
      let n = r(e).cron, o = m(n, s.__wbindgen_export, s.__wbindgen_export2), u = p;
      f().setInt32(t + 4, u, true), f().setInt32(t + 0, o, true);
    }, arguments);
  }, "__wbg_cron_6628fcfb7c02d168"), __wbg_done_57b39ecd9addfe81: /* @__PURE__ */ __name(function(t) {
    return r(t).done;
  }, "__wbg_done_57b39ecd9addfe81"), __wbg_enqueue_2c63f2044f257c3e: /* @__PURE__ */ __name(function() {
    return b(function(t, e) {
      r(t).enqueue(r(e));
    }, arguments);
  }, "__wbg_enqueue_2c63f2044f257c3e"), __wbg_entries_58c7934c745daac7: /* @__PURE__ */ __name(function(t) {
    let e = Object.entries(r(t));
    return i(e);
  }, "__wbg_entries_58c7934c745daac7"), __wbg_error_7534b8e9a36f1ab4: /* @__PURE__ */ __name(function(t, e) {
    let n, o;
    try {
      n = t, o = e, console.error(y(t, e));
    } finally {
      s.__wbindgen_export4(n, o, 1);
    }
  }, "__wbg_error_7534b8e9a36f1ab4"), __wbg_error_9a7fe3f932034cde: /* @__PURE__ */ __name(function(t) {
    console.error(r(t));
  }, "__wbg_error_9a7fe3f932034cde"), __wbg_error_f852e41c69b0bd84: /* @__PURE__ */ __name(function(t, e) {
    console.error(r(t), r(e));
  }, "__wbg_error_f852e41c69b0bd84"), __wbg_fetch_2c1e75cf1cd9a524: /* @__PURE__ */ __name(function(t, e, n, o) {
    let u = r(t).fetch(y(e, n), r(o));
    return i(u);
  }, "__wbg_fetch_2c1e75cf1cd9a524"), __wbg_fetch_837e04d0f9875d60: /* @__PURE__ */ __name(function() {
    return b(function(t, e) {
      let n = r(t).fetch(r(e));
      return i(n);
    }, arguments);
  }, "__wbg_fetch_837e04d0f9875d60"), __wbg_fetch_c97461e1e8f610cd: /* @__PURE__ */ __name(function(t, e, n) {
    let o = r(t).fetch(r(e), r(n));
    return i(o);
  }, "__wbg_fetch_c97461e1e8f610cd"), __wbg_getReader_48e00749fe3f6089: /* @__PURE__ */ __name(function() {
    return b(function(t) {
      let e = r(t).getReader();
      return i(e);
    }, arguments);
  }, "__wbg_getReader_48e00749fe3f6089"), __wbg_getTime_1e3cd1391c5c3995: /* @__PURE__ */ __name(function(t) {
    return r(t).getTime();
  }, "__wbg_getTime_1e3cd1391c5c3995"), __wbg_get_9b94d73e6221f75c: /* @__PURE__ */ __name(function(t, e) {
    let n = r(t)[e >>> 0];
    return i(n);
  }, "__wbg_get_9b94d73e6221f75c"), __wbg_get_b3ed3ad4be2bc8ac: /* @__PURE__ */ __name(function() {
    return b(function(t, e) {
      let n = Reflect.get(r(t), r(e));
      return i(n);
    }, arguments);
  }, "__wbg_get_b3ed3ad4be2bc8ac"), __wbg_get_done_1ad1c16537f444c6: /* @__PURE__ */ __name(function(t) {
    let e = r(t).done;
    return g(e) ? 16777215 : e ? 1 : 0;
  }, "__wbg_get_done_1ad1c16537f444c6"), __wbg_get_value_6b77a1b7b90c9200: /* @__PURE__ */ __name(function(t) {
    let e = r(t).value;
    return i(e);
  }, "__wbg_get_value_6b77a1b7b90c9200"), __wbg_get_with_ref_key_1dc361bd10053bfe: /* @__PURE__ */ __name(function(t, e) {
    let n = r(t)[r(e)];
    return i(n);
  }, "__wbg_get_with_ref_key_1dc361bd10053bfe"), __wbg_headers_59a2938db9f80985: /* @__PURE__ */ __name(function(t) {
    let e = r(t).headers;
    return i(e);
  }, "__wbg_headers_59a2938db9f80985"), __wbg_headers_5a897f7fee9a0571: /* @__PURE__ */ __name(function(t) {
    let e = r(t).headers;
    return i(e);
  }, "__wbg_headers_5a897f7fee9a0571"), __wbg_instanceof_ArrayBuffer_c367199e2fa2aa04: /* @__PURE__ */ __name(function(t) {
    let e;
    try {
      e = r(t) instanceof ArrayBuffer;
    } catch {
      e = false;
    }
    return e;
  }, "__wbg_instanceof_ArrayBuffer_c367199e2fa2aa04"), __wbg_instanceof_Error_8573fe0b0b480f46: /* @__PURE__ */ __name(function(t) {
    let e;
    try {
      e = r(t) instanceof Error;
    } catch {
      e = false;
    }
    return e;
  }, "__wbg_instanceof_Error_8573fe0b0b480f46"), __wbg_instanceof_Map_53af74335dec57f4: /* @__PURE__ */ __name(function(t) {
    let e;
    try {
      e = r(t) instanceof Map;
    } catch {
      e = false;
    }
    return e;
  }, "__wbg_instanceof_Map_53af74335dec57f4"), __wbg_instanceof_ReadableStream_8ab3825017e203e9: /* @__PURE__ */ __name(function(t) {
    let e;
    try {
      e = r(t) instanceof ReadableStream;
    } catch {
      e = false;
    }
    return e;
  }, "__wbg_instanceof_ReadableStream_8ab3825017e203e9"), __wbg_instanceof_Response_ee1d54d79ae41977: /* @__PURE__ */ __name(function(t) {
    let e;
    try {
      e = r(t) instanceof Response;
    } catch {
      e = false;
    }
    return e;
  }, "__wbg_instanceof_Response_ee1d54d79ae41977"), __wbg_instanceof_Uint8Array_9b9075935c74707c: /* @__PURE__ */ __name(function(t) {
    let e;
    try {
      e = r(t) instanceof Uint8Array;
    } catch {
      e = false;
    }
    return e;
  }, "__wbg_instanceof_Uint8Array_9b9075935c74707c"), __wbg_isArray_d314bb98fcf08331: /* @__PURE__ */ __name(function(t) {
    return Array.isArray(r(t));
  }, "__wbg_isArray_d314bb98fcf08331"), __wbg_isSafeInteger_bfbc7332a9768d2a: /* @__PURE__ */ __name(function(t) {
    return Number.isSafeInteger(r(t));
  }, "__wbg_isSafeInteger_bfbc7332a9768d2a"), __wbg_iterator_6ff6560ca1568e55: /* @__PURE__ */ __name(function() {
    return i(Symbol.iterator);
  }, "__wbg_iterator_6ff6560ca1568e55"), __wbg_length_32ed9a279acd054c: /* @__PURE__ */ __name(function(t) {
    return r(t).length;
  }, "__wbg_length_32ed9a279acd054c"), __wbg_length_35a7bace40f36eac: /* @__PURE__ */ __name(function(t) {
    return r(t).length;
  }, "__wbg_length_35a7bace40f36eac"), __wbg_log_6b5ca2e6124b2808: /* @__PURE__ */ __name(function(t) {
    console.log(r(t));
  }, "__wbg_log_6b5ca2e6124b2808"), __wbg_method_a9e9b2fcba5440fb: /* @__PURE__ */ __name(function(t, e) {
    let n = r(e).method, o = m(n, s.__wbindgen_export, s.__wbindgen_export2), u = p;
    f().setInt32(t + 4, u, true), f().setInt32(t + 0, o, true);
  }, "__wbg_method_a9e9b2fcba5440fb"), __wbg_minifyconfig_new: /* @__PURE__ */ __name(function(t) {
    let e = I.__wrap(t);
    return i(e);
  }, "__wbg_minifyconfig_new"), __wbg_name_07a54d72942d5492: /* @__PURE__ */ __name(function(t) {
    let e = r(t).name;
    return i(e);
  }, "__wbg_name_07a54d72942d5492"), __wbg_new_245cd5c49157e602: /* @__PURE__ */ __name(function(t) {
    let e = new Date(r(t));
    return i(e);
  }, "__wbg_new_245cd5c49157e602"), __wbg_new_361308b2356cecd0: /* @__PURE__ */ __name(function() {
    let t = new Object();
    return i(t);
  }, "__wbg_new_361308b2356cecd0"), __wbg_new_3eb36ae241fe6f44: /* @__PURE__ */ __name(function() {
    let t = new Array();
    return i(t);
  }, "__wbg_new_3eb36ae241fe6f44"), __wbg_new_64284bd487f9d239: /* @__PURE__ */ __name(function() {
    return b(function() {
      let t = new Headers();
      return i(t);
    }, arguments);
  }, "__wbg_new_64284bd487f9d239"), __wbg_new_72b49615380db768: /* @__PURE__ */ __name(function(t, e) {
    let n = new Error(y(t, e));
    return i(n);
  }, "__wbg_new_72b49615380db768"), __wbg_new_8a6f238a6ece86ea: /* @__PURE__ */ __name(function() {
    let t = new Error();
    return i(t);
  }, "__wbg_new_8a6f238a6ece86ea"), __wbg_new_b5d9e2fb389fef91: /* @__PURE__ */ __name(function(t, e) {
    try {
      var n = { a: t, b: e }, o = /* @__PURE__ */ __name((a, d) => {
        let h = n.a;
        n.a = 0;
        try {
          return tt(h, n.b, a, d);
        } finally {
          n.a = h;
        }
      }, "o");
      let u = new Promise(o);
      return i(u);
    } finally {
      n.a = n.b = 0;
    }
  }, "__wbg_new_b5d9e2fb389fef91"), __wbg_new_dca287b076112a51: /* @__PURE__ */ __name(function() {
    return i(/* @__PURE__ */ new Map());
  }, "__wbg_new_dca287b076112a51"), __wbg_new_dd2b680c8bf6ae29: /* @__PURE__ */ __name(function(t) {
    let e = new Uint8Array(r(t));
    return i(e);
  }, "__wbg_new_dd2b680c8bf6ae29"), __wbg_new_no_args_1c7c842f08d00ebb: /* @__PURE__ */ __name(function(t, e) {
    let n = new Function(y(t, e));
    return i(n);
  }, "__wbg_new_no_args_1c7c842f08d00ebb"), __wbg_new_with_byte_offset_and_length_aa261d9c9da49eb1: /* @__PURE__ */ __name(function(t, e, n) {
    let o = new Uint8Array(r(t), e >>> 0, n >>> 0);
    return i(o);
  }, "__wbg_new_with_byte_offset_and_length_aa261d9c9da49eb1"), __wbg_new_with_length_a2c39cbe88fd8ff1: /* @__PURE__ */ __name(function(t) {
    let e = new Uint8Array(t >>> 0);
    return i(e);
  }, "__wbg_new_with_length_a2c39cbe88fd8ff1"), __wbg_new_with_opt_buffer_source_and_init_8c10f2615c78809b: /* @__PURE__ */ __name(function() {
    return b(function(t, e) {
      let n = new Response(r(t), r(e));
      return i(n);
    }, arguments);
  }, "__wbg_new_with_opt_buffer_source_and_init_8c10f2615c78809b"), __wbg_new_with_opt_readable_stream_and_init_8a044befefe6d8bb: /* @__PURE__ */ __name(function() {
    return b(function(t, e) {
      let n = new Response(r(t), r(e));
      return i(n);
    }, arguments);
  }, "__wbg_new_with_opt_readable_stream_and_init_8a044befefe6d8bb"), __wbg_new_with_opt_str_and_init_4fbb71523b271b6e: /* @__PURE__ */ __name(function() {
    return b(function(t, e, n) {
      let o = new Response(t === 0 ? void 0 : y(t, e), r(n));
      return i(o);
    }, arguments);
  }, "__wbg_new_with_opt_str_and_init_4fbb71523b271b6e"), __wbg_new_with_str_and_init_a61cbc6bdef21614: /* @__PURE__ */ __name(function() {
    return b(function(t, e, n) {
      let o = new Request(y(t, e), r(n));
      return i(o);
    }, arguments);
  }, "__wbg_new_with_str_and_init_a61cbc6bdef21614"), __wbg_next_3482f54c49e8af19: /* @__PURE__ */ __name(function() {
    return b(function(t) {
      let e = r(t).next();
      return i(e);
    }, arguments);
  }, "__wbg_next_3482f54c49e8af19"), __wbg_next_418f80d8f5303233: /* @__PURE__ */ __name(function(t) {
    let e = r(t).next;
    return i(e);
  }, "__wbg_next_418f80d8f5303233"), __wbg_now_a3af9a2f4bbaa4d1: /* @__PURE__ */ __name(function() {
    return Date.now();
  }, "__wbg_now_a3af9a2f4bbaa4d1"), __wbg_prototypesetcall_bdcdcc5842e4d77d: /* @__PURE__ */ __name(function(t, e, n) {
    Uint8Array.prototype.set.call($(t, e), r(n));
  }, "__wbg_prototypesetcall_bdcdcc5842e4d77d"), __wbg_queueMicrotask_0aa0a927f78f5d98: /* @__PURE__ */ __name(function(t) {
    let e = r(t).queueMicrotask;
    return i(e);
  }, "__wbg_queueMicrotask_0aa0a927f78f5d98"), __wbg_queueMicrotask_5bb536982f78a56f: /* @__PURE__ */ __name(function(t) {
    queueMicrotask(r(t));
  }, "__wbg_queueMicrotask_5bb536982f78a56f"), __wbg_read_68fd377df67e19b0: /* @__PURE__ */ __name(function(t) {
    let e = r(t).read();
    return i(e);
  }, "__wbg_read_68fd377df67e19b0"), __wbg_releaseLock_aa5846c2494b3032: /* @__PURE__ */ __name(function(t) {
    r(t).releaseLock();
  }, "__wbg_releaseLock_aa5846c2494b3032"), __wbg_resolve_002c4b7d9d8f6b64: /* @__PURE__ */ __name(function(t) {
    let e = Promise.resolve(r(t));
    return i(e);
  }, "__wbg_resolve_002c4b7d9d8f6b64"), __wbg_respond_bf6ab10399ca8722: /* @__PURE__ */ __name(function() {
    return b(function(t, e) {
      r(t).respond(e >>> 0);
    }, arguments);
  }, "__wbg_respond_bf6ab10399ca8722"), __wbg_scheduledTime_b7ced2b2df17e4e5: /* @__PURE__ */ __name(function() {
    return b(function(t) {
      return r(t).scheduledTime;
    }, arguments);
  }, "__wbg_scheduledTime_b7ced2b2df17e4e5"), __wbg_set_1eb0999cf5d27fc8: /* @__PURE__ */ __name(function(t, e, n) {
    let o = r(t).set(r(e), r(n));
    return i(o);
  }, "__wbg_set_1eb0999cf5d27fc8"), __wbg_set_3f1d0b984ed272ed: /* @__PURE__ */ __name(function(t, e, n) {
    r(t)[l(e)] = l(n);
  }, "__wbg_set_3f1d0b984ed272ed"), __wbg_set_6cb8631f80447a67: /* @__PURE__ */ __name(function() {
    return b(function(t, e, n) {
      return Reflect.set(r(t), r(e), r(n));
    }, arguments);
  }, "__wbg_set_6cb8631f80447a67"), __wbg_set_body_9a7e00afe3cfe244: /* @__PURE__ */ __name(function(t, e) {
    r(t).body = r(e);
  }, "__wbg_set_body_9a7e00afe3cfe244"), __wbg_set_cache_315a3ed773a41543: /* @__PURE__ */ __name(function(t, e) {
    r(t).cache = nt[e];
  }, "__wbg_set_cache_315a3ed773a41543"), __wbg_set_cc56eefd2dd91957: /* @__PURE__ */ __name(function(t, e, n) {
    r(t).set($(e, n));
  }, "__wbg_set_cc56eefd2dd91957"), __wbg_set_db769d02949a271d: /* @__PURE__ */ __name(function() {
    return b(function(t, e, n, o, u) {
      r(t).set(y(e, n), y(o, u));
    }, arguments);
  }, "__wbg_set_db769d02949a271d"), __wbg_set_f43e577aea94465b: /* @__PURE__ */ __name(function(t, e, n) {
    r(t)[e >>> 0] = l(n);
  }, "__wbg_set_f43e577aea94465b"), __wbg_set_headers_bbdfebba19309590: /* @__PURE__ */ __name(function(t, e) {
    r(t).headers = r(e);
  }, "__wbg_set_headers_bbdfebba19309590"), __wbg_set_headers_cfc5f4b2c1f20549: /* @__PURE__ */ __name(function(t, e) {
    r(t).headers = r(e);
  }, "__wbg_set_headers_cfc5f4b2c1f20549"), __wbg_set_method_c3e20375f5ae7fac: /* @__PURE__ */ __name(function(t, e, n) {
    r(t).method = y(e, n);
  }, "__wbg_set_method_c3e20375f5ae7fac"), __wbg_set_redirect_a7956fa3f817cbbc: /* @__PURE__ */ __name(function(t, e) {
    r(t).redirect = rt[e];
  }, "__wbg_set_redirect_a7956fa3f817cbbc"), __wbg_set_signal_f2d3f8599248896d: /* @__PURE__ */ __name(function(t, e) {
    r(t).signal = r(e);
  }, "__wbg_set_signal_f2d3f8599248896d"), __wbg_set_status_fa41f71c4575bca5: /* @__PURE__ */ __name(function(t, e) {
    r(t).status = e;
  }, "__wbg_set_status_fa41f71c4575bca5"), __wbg_stack_0ed75d68575b0f3c: /* @__PURE__ */ __name(function(t, e) {
    let n = r(e).stack, o = m(n, s.__wbindgen_export, s.__wbindgen_export2), u = p;
    f().setInt32(t + 4, u, true), f().setInt32(t + 0, o, true);
  }, "__wbg_stack_0ed75d68575b0f3c"), __wbg_static_accessor_GLOBAL_12837167ad935116: /* @__PURE__ */ __name(function() {
    let t = typeof global > "u" ? null : global;
    return g(t) ? 0 : i(t);
  }, "__wbg_static_accessor_GLOBAL_12837167ad935116"), __wbg_static_accessor_GLOBAL_THIS_e628e89ab3b1c95f: /* @__PURE__ */ __name(function() {
    let t = typeof globalThis > "u" ? null : globalThis;
    return g(t) ? 0 : i(t);
  }, "__wbg_static_accessor_GLOBAL_THIS_e628e89ab3b1c95f"), __wbg_static_accessor_SELF_a621d3dfbb60d0ce: /* @__PURE__ */ __name(function() {
    let t = typeof self > "u" ? null : self;
    return g(t) ? 0 : i(t);
  }, "__wbg_static_accessor_SELF_a621d3dfbb60d0ce"), __wbg_static_accessor_WINDOW_f8727f0cf888e0bd: /* @__PURE__ */ __name(function() {
    let t = typeof window > "u" ? null : window;
    return g(t) ? 0 : i(t);
  }, "__wbg_static_accessor_WINDOW_f8727f0cf888e0bd"), __wbg_status_89d7e803db911ee7: /* @__PURE__ */ __name(function(t) {
    return r(t).status;
  }, "__wbg_status_89d7e803db911ee7"), __wbg_stringify_8d1cc6ff383e8bae: /* @__PURE__ */ __name(function() {
    return b(function(t) {
      let e = JSON.stringify(r(t));
      return i(e);
    }, arguments);
  }, "__wbg_stringify_8d1cc6ff383e8bae"), __wbg_then_0d9fe2c7b1857d32: /* @__PURE__ */ __name(function(t, e, n) {
    let o = r(t).then(r(e), r(n));
    return i(o);
  }, "__wbg_then_0d9fe2c7b1857d32"), __wbg_then_b9e7b3b5f1a9e1b5: /* @__PURE__ */ __name(function(t, e) {
    let n = r(t).then(r(e));
    return i(n);
  }, "__wbg_then_b9e7b3b5f1a9e1b5"), __wbg_toString_029ac24421fd7a24: /* @__PURE__ */ __name(function(t) {
    let e = r(t).toString();
    return i(e);
  }, "__wbg_toString_029ac24421fd7a24"), __wbg_url_36c39f6580d05409: /* @__PURE__ */ __name(function(t, e) {
    let n = r(e).url, o = m(n, s.__wbindgen_export, s.__wbindgen_export2), u = p;
    f().setInt32(t + 4, u, true), f().setInt32(t + 0, o, true);
  }, "__wbg_url_36c39f6580d05409"), __wbg_value_0546255b415e96c1: /* @__PURE__ */ __name(function(t) {
    let e = r(t).value;
    return i(e);
  }, "__wbg_value_0546255b415e96c1"), __wbg_view_6c32e7184b8606ad: /* @__PURE__ */ __name(function(t) {
    let e = r(t).view;
    return g(e) ? 0 : i(e);
  }, "__wbg_view_6c32e7184b8606ad"), __wbg_waitUntil_b603e83be944ec91: /* @__PURE__ */ __name(function() {
    return b(function(t, e) {
      r(t).waitUntil(l(e));
    }, arguments);
  }, "__wbg_waitUntil_b603e83be944ec91"), __wbg_webSocket_5d50b1a6fab8a49d: /* @__PURE__ */ __name(function() {
    return b(function(t) {
      let e = r(t).webSocket;
      return g(e) ? 0 : i(e);
    }, arguments);
  }, "__wbg_webSocket_5d50b1a6fab8a49d"), __wbindgen_cast_0000000000000001: /* @__PURE__ */ __name(function(t, e) {
    let n = at(t, e, s.__wasm_bindgen_func_elem_1749, Z);
    return i(n);
  }, "__wbindgen_cast_0000000000000001"), __wbindgen_cast_0000000000000002: /* @__PURE__ */ __name(function(t) {
    return i(t);
  }, "__wbindgen_cast_0000000000000002"), __wbindgen_cast_0000000000000003: /* @__PURE__ */ __name(function(t) {
    return i(t);
  }, "__wbindgen_cast_0000000000000003"), __wbindgen_cast_0000000000000004: /* @__PURE__ */ __name(function(t, e) {
    let n = y(t, e);
    return i(n);
  }, "__wbindgen_cast_0000000000000004"), __wbindgen_cast_0000000000000005: /* @__PURE__ */ __name(function(t) {
    let e = BigInt.asUintN(64, t);
    return i(e);
  }, "__wbindgen_cast_0000000000000005"), __wbindgen_object_clone_ref: /* @__PURE__ */ __name(function(t) {
    let e = r(t);
    return i(e);
  }, "__wbindgen_object_clone_ref"), __wbindgen_object_drop_ref: /* @__PURE__ */ __name(function(t) {
    l(t);
  }, "__wbindgen_object_drop_ref") } };
}
__name(K, "K");
function Z(_2, t, e) {
  s.__wasm_bindgen_func_elem_1750(_2, t, i(e));
}
__name(Z, "Z");
function tt(_2, t, e, n) {
  s.__wasm_bindgen_func_elem_859(_2, t, i(e), i(n));
}
__name(tt, "tt");
var et = ["bytes"];
var nt = ["default", "no-store", "reload", "no-cache", "force-cache", "only-if-cached"];
var rt = ["follow", "error", "manual"];
var c = 0;
var _t = typeof FinalizationRegistry > "u" ? { register: /* @__PURE__ */ __name(() => {
}, "register"), unregister: /* @__PURE__ */ __name(() => {
}, "unregister") } : new FinalizationRegistry(({ ptr: _2, instance: t }) => {
  t === c && s.__wbg_containerstartupoptions_free(_2 >>> 0, 1);
});
var ot = typeof FinalizationRegistry > "u" ? { register: /* @__PURE__ */ __name(() => {
}, "register"), unregister: /* @__PURE__ */ __name(() => {
}, "unregister") } : new FinalizationRegistry(({ ptr: _2, instance: t }) => {
  t === c && s.__wbg_intounderlyingbytesource_free(_2 >>> 0, 1);
});
var it = typeof FinalizationRegistry > "u" ? { register: /* @__PURE__ */ __name(() => {
}, "register"), unregister: /* @__PURE__ */ __name(() => {
}, "unregister") } : new FinalizationRegistry(({ ptr: _2, instance: t }) => {
  t === c && s.__wbg_intounderlyingsink_free(_2 >>> 0, 1);
});
var st = typeof FinalizationRegistry > "u" ? { register: /* @__PURE__ */ __name(() => {
}, "register"), unregister: /* @__PURE__ */ __name(() => {
}, "unregister") } : new FinalizationRegistry(({ ptr: _2, instance: t }) => {
  t === c && s.__wbg_intounderlyingsource_free(_2 >>> 0, 1);
});
var H = typeof FinalizationRegistry > "u" ? { register: /* @__PURE__ */ __name(() => {
}, "register"), unregister: /* @__PURE__ */ __name(() => {
}, "unregister") } : new FinalizationRegistry(({ ptr: _2, instance: t }) => {
  t === c && s.__wbg_minifyconfig_free(_2 >>> 0, 1);
});
var ct = typeof FinalizationRegistry > "u" ? { register: /* @__PURE__ */ __name(() => {
}, "register"), unregister: /* @__PURE__ */ __name(() => {
}, "unregister") } : new FinalizationRegistry(({ ptr: _2, instance: t }) => {
  t === c && s.__wbg_r2range_free(_2 >>> 0, 1);
});
function i(_2) {
  v === w.length && w.push(w.length + 1);
  let t = v;
  return v = w[t], w[t] = _2, t;
}
__name(i, "i");
var N = typeof FinalizationRegistry > "u" ? { register: /* @__PURE__ */ __name(() => {
}, "register"), unregister: /* @__PURE__ */ __name(() => {
}, "unregister") } : new FinalizationRegistry((_2) => {
  _2.instance === c && _2.dtor(_2.a, _2.b);
});
function L(_2) {
  let t = typeof _2;
  if (t == "number" || t == "boolean" || _2 == null) return `${_2}`;
  if (t == "string") return `"${_2}"`;
  if (t == "symbol") {
    let o = _2.description;
    return o == null ? "Symbol" : `Symbol(${o})`;
  }
  if (t == "function") {
    let o = _2.name;
    return typeof o == "string" && o.length > 0 ? `Function(${o})` : "Function";
  }
  if (Array.isArray(_2)) {
    let o = _2.length, u = "[";
    o > 0 && (u += L(_2[0]));
    for (let a = 1; a < o; a++) u += ", " + L(_2[a]);
    return u += "]", u;
  }
  let e = /\[object ([^\]]+)\]/.exec(toString.call(_2)), n;
  if (e && e.length > 1) n = e[1];
  else return toString.call(_2);
  if (n == "Object") try {
    return "Object(" + JSON.stringify(_2) + ")";
  } catch {
    return "Object";
  }
  return _2 instanceof Error ? `${_2.name}: ${_2.message}
${_2.stack}` : n;
}
__name(L, "L");
function ut(_2) {
  _2 < 132 || (w[_2] = v, v = _2);
}
__name(ut, "ut");
function ft(_2, t) {
  _2 = _2 >>> 0;
  let e = f(), n = [];
  for (let o = _2; o < _2 + 4 * t; o += 4) n.push(l(e.getUint32(o, true)));
  return n;
}
__name(ft, "ft");
function $(_2, t) {
  return _2 = _2 >>> 0, O().subarray(_2 / 1, _2 / 1 + t);
}
__name($, "$");
var x = null;
function f() {
  return (x === null || x.buffer.detached === true || x.buffer.detached === void 0 && x.buffer !== s.memory.buffer) && (x = new DataView(s.memory.buffer)), x;
}
__name(f, "f");
function y(_2, t) {
  return _2 = _2 >>> 0, gt(_2, t);
}
__name(y, "y");
var A = null;
function O() {
  return (A === null || A.byteLength === 0) && (A = new Uint8Array(s.memory.buffer)), A;
}
__name(O, "O");
function r(_2) {
  return w[_2];
}
__name(r, "r");
function b(_2, t) {
  try {
    return _2.apply(this, t);
  } catch (e) {
    s.__wbindgen_export3(i(e));
  }
}
__name(b, "b");
var w = new Array(128).fill(void 0);
w.push(void 0, null, true, false);
var v = w.length;
function g(_2) {
  return _2 == null;
}
__name(g, "g");
function at(_2, t, e, n) {
  let o = { a: _2, b: t, cnt: 1, dtor: e, instance: c }, u = /* @__PURE__ */ __name((...a) => {
    if (o.instance !== c) throw new Error("Cannot invoke closure from previous WASM instance");
    o.cnt++;
    let d = o.a;
    o.a = 0;
    try {
      return n(d, o.b, ...a);
    } finally {
      o.a = d, u._wbg_cb_unref();
    }
  }, "u");
  return u._wbg_cb_unref = () => {
    --o.cnt === 0 && (o.dtor(o.a, o.b), o.a = 0, N.unregister(o));
  }, N.register(u, o, o), u;
}
__name(at, "at");
function bt(_2, t) {
  let e = t(_2.length * 4, 4) >>> 0, n = f();
  for (let o = 0; o < _2.length; o++) n.setUint32(e + 4 * o, i(_2[o]), true);
  return p = _2.length, e;
}
__name(bt, "bt");
function m(_2, t, e) {
  if (e === void 0) {
    let d = P.encode(_2), h = t(d.length, 1) >>> 0;
    return O().subarray(h, h + d.length).set(d), p = d.length, h;
  }
  let n = _2.length, o = t(n, 1) >>> 0, u = O(), a = 0;
  for (; a < n; a++) {
    let d = _2.charCodeAt(a);
    if (d > 127) break;
    u[o + a] = d;
  }
  if (a !== n) {
    a !== 0 && (_2 = _2.slice(a)), o = e(o, n, n = a + _2.length * 3, 1) >>> 0;
    let d = O().subarray(o + a, o + n), h = P.encodeInto(_2, d);
    a += h.written, o = e(o, n, a, 1) >>> 0;
  }
  return p = a, o;
}
__name(m, "m");
function l(_2) {
  let t = r(_2);
  return ut(_2), t;
}
__name(l, "l");
var Q = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
Q.decode();
function gt(_2, t) {
  return Q.decode(O().subarray(_2, _2 + t));
}
__name(gt, "gt");
var P = new TextEncoder();
"encodeInto" in P || (P.encodeInto = function(_2, t) {
  let e = P.encode(_2);
  return t.set(e), { read: _2.length, written: e.length };
});
var p = 0;
var dt = new WebAssembly.Instance(X, K());
var s = dt.exports;
Error.stackTraceLimit = 100;
var z = false;
function Y() {
  q && q(function(_2) {
    let t = new Error("Rust panic: " + _2);
    console.error("Critical", t), z = true;
  });
}
__name(Y, "Y");
Y();
var M = 0;
function D() {
  z && (console.log("Reinitializing Wasm application"), V(), z = false, Y(), M++);
}
__name(D, "D");
addEventListener("error", (_2) => {
  B(_2.error);
});
function B(_2) {
  _2 instanceof WebAssembly.RuntimeError && (console.error("Critical", _2), z = true);
}
__name(B, "B");
var U = class extends lt {
  static {
    __name(this, "U");
  }
};
U.prototype.fetch = function(t) {
  return J.call(this, t, this.env, this.ctx);
};
U.prototype.scheduled = function(t) {
  return G.call(this, t, this.env, this.ctx);
};
var pt = { set: /* @__PURE__ */ __name((_2, t, e, n) => Reflect.set(_2.instance, t, e, n), "set"), has: /* @__PURE__ */ __name((_2, t) => Reflect.has(_2.instance, t), "has"), deleteProperty: /* @__PURE__ */ __name((_2, t) => Reflect.deleteProperty(_2.instance, t), "deleteProperty"), apply: /* @__PURE__ */ __name((_2, t, e) => Reflect.apply(_2.instance, t, e), "apply"), construct: /* @__PURE__ */ __name((_2, t, e) => Reflect.construct(_2.instance, t, e), "construct"), getPrototypeOf: /* @__PURE__ */ __name((_2) => Reflect.getPrototypeOf(_2.instance), "getPrototypeOf"), setPrototypeOf: /* @__PURE__ */ __name((_2, t) => Reflect.setPrototypeOf(_2.instance, t), "setPrototypeOf"), isExtensible: /* @__PURE__ */ __name((_2) => Reflect.isExtensible(_2.instance), "isExtensible"), preventExtensions: /* @__PURE__ */ __name((_2) => Reflect.preventExtensions(_2.instance), "preventExtensions"), getOwnPropertyDescriptor: /* @__PURE__ */ __name((_2, t) => Reflect.getOwnPropertyDescriptor(_2.instance, t), "getOwnPropertyDescriptor"), defineProperty: /* @__PURE__ */ __name((_2, t, e) => Reflect.defineProperty(_2.instance, t, e), "defineProperty"), ownKeys: /* @__PURE__ */ __name((_2) => Reflect.ownKeys(_2.instance), "ownKeys") };
var R = { construct(_2, t, e) {
  try {
    D();
    let n = { instance: Reflect.construct(_2, t, e), instanceId: M, ctor: _2, args: t, newTarget: e };
    return new Proxy(n, { ...pt, get(o, u, a) {
      o.instanceId !== M && (o.instance = Reflect.construct(o.ctor, o.args, o.newTarget), o.instanceId = M);
      let d = Reflect.get(o.instance, u, a);
      return typeof d != "function" ? d : d.constructor === Function ? new Proxy(d, { apply(h, T, C) {
        D();
        try {
          return h.apply(T, C);
        } catch (W) {
          throw B(W), W;
        }
      } }) : new Proxy(d, { async apply(h, T, C) {
        D();
        try {
          return await h.apply(T, C);
        } catch (W) {
          throw B(W), W;
        }
      } });
    } });
  } catch (n) {
    throw z = true, n;
  }
} };
var mt = new Proxy(U, R);
var xt = new Proxy(F, R);
var vt = new Proxy(E, R);
var It = new Proxy(j, R);
var Rt = new Proxy(S, R);
var Ft = new Proxy(I, R);
var Et = new Proxy(k, R);

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-TcodUH/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = mt;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-TcodUH/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  xt as ContainerStartupOptions,
  vt as IntoUnderlyingByteSource,
  It as IntoUnderlyingSink,
  Rt as IntoUnderlyingSource,
  Ft as MinifyConfig,
  Et as R2Range,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=shim.js.map
