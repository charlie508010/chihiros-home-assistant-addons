#!/usr/bin/env python3
from __future__ import annotations

import runpy
import sys
import types
from importlib.machinery import ModuleSpec
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
    chihiros_root = _find_chihiros_root()
    if chihiros_root is None:
        print("Chihiros source was not found in the add-on container.")
        print("Checked: /opt/chihiros-src/custom_components/chihiros and /config/custom_components/chihiros")
        raise SystemExit(2)
    custom_components_root = chihiros_root.parent

    custom_components = types.ModuleType("custom_components")
    custom_components.__path__ = [str(custom_components_root)]
    custom_components.__spec__ = ModuleSpec("custom_components", loader=None, is_package=True)
    custom_components.__spec__.submodule_search_locations = [str(custom_components_root)]

    chihiros_pkg = types.ModuleType("custom_components.chihiros")
    chihiros_pkg.__path__ = [str(chihiros_root)]
    chihiros_pkg.__spec__ = ModuleSpec("custom_components.chihiros", loader=None, is_package=True)
    chihiros_pkg.__spec__.submodule_search_locations = [str(chihiros_root)]

    sys.modules["custom_components"] = custom_components
    sys.modules["custom_components.chihiros"] = chihiros_pkg

    if len(sys.argv) >= 2 and sys.argv[1] == "wireshark":
        sys.argv = ["chihirosctl", *sys.argv[2:]]
        if (chihiros_root / "chihiros_wireshark_control" / "wiresharkctl.py").is_file():
            module = "custom_components.chihiros.chihiros_wireshark_control.wiresharkctl"
        else:
            module = "custom_components.chihiros.vendor.legacy_ctl.chihiros_wireshark_control.wiresharkctl"
        runpy.run_module(module, run_name="__main__")
        return

    if (chihiros_root / "chihiros_led_control" / "chihirosctl.py").is_file():
        module = "custom_components.chihiros.chihiros_led_control.chihirosctl"
    else:
        module = "custom_components.chihiros.vendor.legacy_ctl.chihiros_led_control_old.chihirosctl"
    runpy.run_module(module, run_name="__main__")


def _find_chihiros_root() -> Path | None:
    candidates = [
        Path("/opt/chihiros-src/custom_components/chihiros"),
        Path("/config/custom_components/chihiros"),
    ]
    for candidate in candidates:
        if _has_ctl_entrypoint(candidate):
            return candidate
    for base in (Path("/opt/chihiros-src"), Path("/config")):
        if not base.exists():
            continue
        for candidate in base.glob("**/custom_components/chihiros"):
            if _has_ctl_entrypoint(candidate):
                return candidate
    return None


def _has_ctl_entrypoint(candidate: Path) -> bool:
    return (
        (candidate / "chihiros_led_control" / "chihirosctl.py").is_file()
        or (candidate / "vendor" / "legacy_ctl" / "chihiros_led_control_old" / "chihirosctl.py").is_file()
    )


if __name__ == "__main__":
    main()
