"""Sandbox runner: executes ONE analysis request and prints JSON to stdout.

Input (stdin, JSON):
  {"script": "monte_carlo", "inputs": {...}}     # a trusted script from ./scripts
  {"code": "result = ...", "inputs": {...}}       # custom code, restricted

It is always started as a separate process (python -I runner.py) with a timeout,
so a crash, infinite loop or memory blow-up never touches the API server.
Inside Docker it additionally has no internet, a read-only filesystem and CPU/memory limits.
"""
from __future__ import annotations

import ast
import importlib
import json
import math
import statistics
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

ALLOWED_IMPORTS = {"math", "statistics", "json", "datetime", "numpy", "pandas", "random"}
BLOCKED_NAMES = {"open", "exec", "eval", "compile", "__import__", "input", "globals", "locals", "vars", "getattr", "setattr", "delattr", "breakpoint", "help", "exit", "quit"}
# file / process access through library helpers is blocked too
BLOCKED_ATTRS = {
    "read_csv", "read_json", "read_excel", "read_pickle", "read_parquet", "read_html", "read_sql", "read_table",
    "to_csv", "to_pickle", "to_parquet", "to_excel", "to_json", "load", "save", "savez", "savetxt", "loadtxt",
    "genfromtxt", "fromfile", "tofile", "memmap", "ctypeslib", "os", "sys", "subprocess", "system", "popen",
}
SAFE_BUILTINS = {
    n: __builtins__[n] if isinstance(__builtins__, dict) else getattr(__builtins__, n)
    for n in [
        "abs", "all", "any", "bool", "dict", "enumerate", "filter", "float", "int", "isinstance", "len", "list",
        "map", "max", "min", "pow", "range", "reversed", "round", "set", "sorted", "str", "sum", "tuple", "zip",
        "ValueError", "ZeroDivisionError", "Exception", "print",
    ]
}


class SandboxViolation(Exception):
    pass


def check_code(code: str) -> None:
    """Static safety check for custom code (defence in depth; Docker is the real wall)."""
    if len(code) > 5000:
        raise SandboxViolation("Code too long (max 5000 characters)")
    tree = ast.parse(code)
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            mods = [a.name for a in node.names] if isinstance(node, ast.Import) else [node.module or ""]
            for m in mods:
                if m.split(".")[0] not in ALLOWED_IMPORTS:
                    raise SandboxViolation(f"Import not allowed: {m}")
        elif isinstance(node, ast.Name) and node.id in BLOCKED_NAMES:
            raise SandboxViolation(f"Use of '{node.id}' is not allowed")
        elif isinstance(node, ast.Attribute) and (node.attr.startswith("_") or node.attr in BLOCKED_ATTRS):
            raise SandboxViolation(f"Attribute '{node.attr}' is not allowed in the sandbox")


def _safe_import(name, globals=None, locals=None, fromlist=(), level=0):  # noqa: A002
    if name.split(".")[0] not in ALLOWED_IMPORTS:
        raise SandboxViolation(f"Import not allowed: {name}")
    return importlib.import_module(name)


def run_code(code: str, inputs: dict):
    check_code(code)
    env = {"__builtins__": {**SAFE_BUILTINS, "__import__": _safe_import}, "inputs": inputs, "math": math, "statistics": statistics}
    try:
        import numpy as np

        env["np"] = np
    except ImportError:
        pass
    exec(compile(code, "<analysis>", "exec"), env)  # noqa: S102  (checked + restricted)
    if "result" not in env:
        raise SandboxViolation("Your code must assign the final answer to a variable named `result`")
    return env["result"]


def _jsonable(x):
    try:
        import numpy as np

        if isinstance(x, np.generic):
            return x.item()
        if isinstance(x, np.ndarray):
            return x.tolist()
    except ImportError:
        pass
    if isinstance(x, float) and (math.isnan(x) or math.isinf(x)):
        return None
    raise TypeError(f"Not JSON serialisable: {type(x).__name__}")


def handle(req: dict) -> dict:
    t0 = time.perf_counter()
    inputs = req.get("inputs") or {}
    if req.get("script"):
        name = str(req["script"])
        if not name.isidentifier():
            raise SandboxViolation("Bad script name")
        module = importlib.import_module(f"scripts.{name}")
        result = module.run(inputs)
    elif req.get("code"):
        result = run_code(req["code"], inputs)
    else:
        raise SandboxViolation("Send either 'script' or 'code'")
    return {"ok": True, "result": result, "ms": int((time.perf_counter() - t0) * 1000)}


def main() -> None:
    try:
        req = json.loads(sys.stdin.read() or "{}")
        out = handle(req)
    except Exception as e:  # noqa: BLE001
        out = {"ok": False, "error": f"{type(e).__name__}: {e}"}
    sys.stdout.write(json.dumps(out, default=_jsonable))


if __name__ == "__main__":
    main()
