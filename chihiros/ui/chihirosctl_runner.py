#!/usr/bin/env python3
from __future__ import annotations

import runpy
import sys
import types
from pathlib import Path


def _install_tkinter_stubs() -> None:
    try:
        import tkinter  # noqa: F401
        return
    except ModuleNotFoundError:
        pass

    class _Dummy:
        def __init__(self, *args, **kwargs):
            self._value = ""

        def __call__(self, *args, **kwargs):
            return self

        def __getattr__(self, _name):
            return self

        def __iter__(self):
            return iter(())

        def __bool__(self):
            return False

        def get(self):
            return self._value

        def set(self, value=""):
            self._value = value

    tk = types.ModuleType("tkinter")
    ttk = types.ModuleType("tkinter.ttk")
    messagebox = types.ModuleType("tkinter.messagebox")
    simpledialog = types.ModuleType("tkinter.simpledialog")
    scrolledtext = types.ModuleType("tkinter.scrolledtext")

    for name in (
        "Tk",
        "Toplevel",
        "Frame",
        "Label",
        "Button",
        "Entry",
        "Text",
        "StringVar",
        "BooleanVar",
        "IntVar",
        "DoubleVar",
    ):
        setattr(tk, name, _Dummy)

    for name in (
        "Frame",
        "LabelFrame",
        "Label",
        "Combobox",
        "Button",
        "Entry",
        "Notebook",
        "Checkbutton",
    ):
        setattr(ttk, name, _Dummy)

    for name in ("W", "E", "N", "S", "EW", "NS", "NSEW", "BOTH", "X", "Y", "END", "DISABLED", "NORMAL"):
        setattr(tk, name, name)

    messagebox.showinfo = lambda *args, **kwargs: None
    messagebox.showerror = lambda *args, **kwargs: None
    messagebox.showwarning = lambda *args, **kwargs: None
    simpledialog.askstring = lambda *args, **kwargs: None
    simpledialog.askinteger = lambda *args, **kwargs: None
    simpledialog.askfloat = lambda *args, **kwargs: None
    scrolledtext.ScrolledText = _Dummy

    tk.ttk = ttk
    tk.messagebox = messagebox
    tk.simpledialog = simpledialog

    sys.modules["tkinter"] = tk
    sys.modules["tkinter.ttk"] = ttk
    sys.modules["tkinter.messagebox"] = messagebox
    sys.modules["tkinter.simpledialog"] = simpledialog
    sys.modules["tkinter.scrolledtext"] = scrolledtext


def main() -> None:
    if len(sys.argv) >= 3 and sys.argv[1] == "doser" and sys.argv[2] == "gui":
        print("GUI commands are not available inside the Home Assistant add-on container.")
        print("Use the Add-on UI tabs or a non-GUI chihirosctl command.")
        raise SystemExit(2)
    _install_tkinter_stubs()
    sys.argv[0] = "chihirosctl"
    source_root = Path("/opt/chihiros-src")
    chihiros_root = source_root / "custom_components" / "chihiros"

    custom_components = types.ModuleType("custom_components")
    custom_components.__path__ = [str(source_root / "custom_components")]
    chihiros_pkg = types.ModuleType("custom_components.chihiros")
    chihiros_pkg.__path__ = [str(chihiros_root)]
    sys.modules.setdefault("custom_components", custom_components)
    sys.modules.setdefault("custom_components.chihiros", chihiros_pkg)

    runpy.run_module("custom_components.chihiros.chihiros_led_control.chihirosctl", run_name="__main__")


if __name__ == "__main__":
    main()
