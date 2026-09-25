#!/usr/bin/env python3
"""Import the public settings catalog from a Sumire Android checkout."""

from __future__ import annotations

import argparse
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

ANDROID = "http://schemas.android.com/apk/res/android"
APP = "http://schemas.android.com/apk/res-auto"
NS = {"android": ANDROID, "app": APP}

FULL_ONLY_RESOURCES = {"pref_ai_conversion.xml", "pref_gemma.xml", "pref_zenz.xml"}
ROUTE_PREFIXES = ("setting_route_", "setting_management_")
RESOURCE_GROUPS = {
    "display": {"pref_keyboard_display.xml"},
    "input": {
        "pref_custom.xml", "pref_hardware_keyboard.xml", "pref_input_method.xml",
        "pref_kana.xml", "pref_qwerty.xml", "pref_qwerty_english.xml",
        "pref_qwerty_romaji.xml", "pref_split_keyboard.xml", "pref_sumire.xml",
        "pref_tablet.xml", "pref_operation_feedback.xml",
    },
    "conversion": {"pref_candidate_conversion.xml", "pref_conversion_engine.xml", "pref_utility_candidate.xml"},
    "dictionary": {"pref_dictionary.xml"},
    "tools": {"pref_clipboard_shortcut.xml"},
    "full": FULL_ONLY_RESOURCES,
}

DYNAMIC_DETAILS = {
    "composing_guide_text_size_setting": {
        "purpose": "未確定文字を表示するフロートガイドの文字サイズを調整します。",
        "default": "28 sp",
        "values": ["18〜56 sp"],
        "range": {"min": "18", "max": "56", "step": None},
        "alsoVerifiedIn": ["app/src/main/java/com/kazumaproject/markdownhelperkeyboard/ime_service/composing_guide/ComposingGuideSettings.kt"],
    },
    "gemma_model_selection_preference": {
        "purpose": "翻訳に使う、端末へ読み込まれた Gemma モデルを選びます。",
        "default": "固定の既定値なし。選択肢は読み込み済みモデルによって変わります。",
        "values": ["端末に読み込み済みの対応 Gemma モデル"],
        "alsoVerifiedIn": ["app/src/main/java/com/kazumaproject/markdownhelperkeyboard/setting_activity/ui/setting/GemmaPreferenceFragment.kt"],
    },
    "split_keyboard_main_type": {
        "purpose": "分割表示のメイン側で使うキーボードを選びます。",
        "default": "TenKey",
        "values": ["TenKey", "50音 (Gojuon)", "Sumire", "QWERTY English", "QWERTY Romaji", "Custom layout"],
        "alsoVerifiedIn": ["app/src/main/java/com/kazumaproject/markdownhelperkeyboard/setting_activity/ui/setting/SplitKeyboardPreferenceFragment.kt", "app/src/main/java/com/kazumaproject/markdownhelperkeyboard/ime_service/state/KeyboardType.kt"],
    },
    "split_keyboard_sub_type": {
        "purpose": "分割表示のサブ側で使うキーボードを選びます。",
        "default": "TenKey",
        "values": ["TenKey", "50音 (Gojuon)", "Sumire", "QWERTY English", "QWERTY Romaji", "Custom layout"],
        "alsoVerifiedIn": ["app/src/main/java/com/kazumaproject/markdownhelperkeyboard/setting_activity/ui/setting/SplitKeyboardPreferenceFragment.kt", "app/src/main/java/com/kazumaproject/markdownhelperkeyboard/ime_service/state/KeyboardType.kt"],
    },
    "split_keyboard_main_custom": {
        "purpose": "メイン側で選択したカスタムキーボードのレイアウトを選びます。",
        "default": "未選択。レイアウトを選ぶと保存されます。",
        "values": ["端末に作成または読み込み済みのカスタムキーボード"],
        "alsoVerifiedIn": ["app/src/main/java/com/kazumaproject/markdownhelperkeyboard/setting_activity/ui/setting/SplitKeyboardPreferenceFragment.kt"],
    },
    "split_keyboard_sub_custom": {
        "purpose": "サブ側で選択したカスタムキーボードのレイアウトを選びます。",
        "default": "未選択。レイアウトを選ぶと保存されます。",
        "values": ["端末に作成または読み込み済みのカスタムキーボード"],
        "alsoVerifiedIn": ["app/src/main/java/com/kazumaproject/markdownhelperkeyboard/setting_activity/ui/setting/SplitKeyboardPreferenceFragment.kt"],
    },
    "split_keyboard_candidates": {
        "purpose": "変換候補欄をメイン側、サブ側、または両方に表示します。",
        "default": "メインとサブ",
        "values": ["メインとサブ", "メインのみ", "サブのみ"],
        "alsoVerifiedIn": ["app/src/main/java/com/kazumaproject/markdownhelperkeyboard/setting_activity/ui/setting/SplitKeyboardPreferenceFragment.kt"],
    },
    "split_keyboard_edit_placement": {
        "purpose": "キーボード編集アイコンをメイン側だけ、または両方に表示します。",
        "default": "メインのみ",
        "values": ["メインのみ", "メインとサブ"],
        "alsoVerifiedIn": ["app/src/main/java/com/kazumaproject/markdownhelperkeyboard/setting_activity/ui/setting/SplitKeyboardPreferenceFragment.kt"],
    },
}


def clean(value: str | None) -> str:
    return " ".join((value or "").split())


def values_file(folder: Path, filename: str) -> dict[str, object]:
    path = folder / filename
    if not path.exists():
        return {}
    root = ET.parse(path).getroot()
    result: dict[str, object] = {}
    for node in root:
        name = node.attrib.get("name")
        if not name:
            continue
        if node.tag == "string":
            result[name] = clean("".join(node.itertext()))
        elif node.tag in ("string-array", "integer-array"):
            result[name] = [clean("".join(child.itertext())) for child in node]
    return result


def parse_literal(value: str) -> object:
    value = value.strip().rstrip(",")
    if value.lower() in ("true", "false"):
        return value.lower() == "true"
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
        return value[1:-1]
    numeric = re.fullmatch(r"(-?\d+(?:\.\d+)?)(?:[fFdDlL])?", value)
    if numeric:
        number = numeric.group(1)
        return float(number) if "." in number else int(number)
    return value


def kotlin_default(source: str, key: str) -> object | None:
    constants = dict(re.findall(r"(?:const\s+)?val\s+(\w+)\s*=\s*['\"]([^'\"]+)['\"]", source))

    def matching_paren(start: int) -> int | None:
        depth = 0
        quote: str | None = None
        escaped = False
        for index in range(start, len(source)):
            char = source[index]
            if quote:
                if escaped:
                    escaped = False
                elif char == "\\":
                    escaped = True
                elif char == quote:
                    quote = None
                continue
            if char in ('"', "'"):
                quote = char
            elif char == "(":
                depth += 1
            elif char == ")":
                depth -= 1
                if depth == 0:
                    return index
        return None

    def split_arguments(value: str) -> list[str]:
        args: list[str] = []
        start = depth = 0
        quote: str | None = None
        escaped = False
        for index, char in enumerate(value):
            if quote:
                if escaped:
                    escaped = False
                elif char == "\\":
                    escaped = True
                elif char == quote:
                    quote = None
                continue
            if char in ('"', "'"):
                quote = char
            elif char == "(":
                depth += 1
            elif char == ")":
                depth -= 1
            elif char == "," and depth == 0:
                args.append(value[start:index].strip())
                start = index + 1
        args.append(value[start:].strip())
        return args

    for match in re.finditer(r"Pair\s*\(", source):
        opening = source.find("(", match.start())
        closing = matching_paren(opening)
        if closing is None:
            continue
        args = split_arguments(source[opening + 1:closing])
        if len(args) < 2:
            continue
        first = args[0].strip()
        pair_key = constants.get(first)
        if first[:1] in ('"', "'") and first[-1:] == first[:1]:
            pair_key = first[1:-1]
        if pair_key == key:
            return parse_literal(args[1])
    return None


def category_for(resource: str, category: str) -> str:
    for name, resources in RESOURCE_GROUPS.items():
        if resource in resources:
            return name
    lowered = category.lower()
    if any(word in lowered for word in ("辞書", "dictionary", "ngram", "ng word")):
        return "dictionary"
    if any(word in lowered for word in ("候補", "変換", "conversion", "prediction", "計算", "単位")):
        return "conversion"
    if any(word in lowered for word in ("クリップ", "shortcut", "記号", "絵文字")):
        return "tools"
    if any(word in lowered for word in ("キーボード", "入力", "qwerty", "かな", "フリック", "操作")):
        return "input"
    return "general"


def resolve(value: str | None, strings: dict[str, object], arrays: dict[str, object]) -> object | None:
    if value is None:
        return None
    value = value.strip()
    match = re.fullmatch(r"@string/(.+)", value)
    if match:
        return strings.get(match.group(1), value)
    match = re.fullmatch(r"@array/(.+)", value)
    if match:
        return arrays.get(match.group(1), value)
    return value


def attribute(node: ET.Element, name: str) -> str | None:
    return node.get(f"{{{ANDROID}}}{name}") or node.get(f"{{{APP}}}{name}")


def key_for_default(item: dict[str, object], values: list[dict[str, str]]) -> str:
    default = item.get("defaultRaw")
    pairs = item.get("options", [])
    if default is not None and pairs:
        token = str(default).split(".")[-1].lower()
        match = next(
            (
                entry["label"]
                for entry in pairs
                if entry["value"].lower() == str(default).lower()
                or entry["value"].lower() == token
                or entry["value"].lower() in token.split("_")
                or entry["value"].lower().replace("_", "") == token.replace("_", "")
            ),
            None,
        )
        if match:
            return match
    if isinstance(default, bool):
        return "ON" if default else "OFF"
    if default == "":
        return "Blank"
    if default is not None:
        return str(default)
    return "Not specified in the XML or AppPreference.kt"


def build(source: Path, commit: str) -> dict[str, object]:
    resources = source / "app/src/main/res"
    xml_dir = resources / "xml"
    strings: dict[str, object] = {}
    arrays: dict[str, object] = {}
    module_order = {"core": 0, "custom_keyboard": 1, "symbol_keyboard": 2, "app": 3}
    value_roots = sorted(
        source.glob("*/src/main/res/values*"),
        key=lambda path: (module_order.get(path.parents[3].name, 4), path.name.endswith("-ja")),
    )
    for folder in value_roots:
        for value_file in sorted(folder.glob("*.xml")):
            strings.update(values_file(folder, value_file.name))
            arrays.update(values_file(folder, value_file.name))
    preference_path = source / "app/src/main/java/com/kazumaproject/markdownhelperkeyboard/setting_activity/AppPreference.kt"
    preference_source = preference_path.read_text(encoding="utf-8")

    items: dict[str, dict[str, object]] = {}
    for path in sorted(xml_dir.glob("pref_*.xml")):
        root = ET.parse(path).getroot()
        category = ""
        for node in root.iter():
            if node.tag == "PreferenceCategory":
                category = clean(str(resolve(attribute(node, "title"), strings, arrays) or ""))
                continue
            key = attribute(node, "key")
            if not key or key.startswith(ROUTE_PREFIXES):
                continue
            title = clean(str(resolve(attribute(node, "title"), strings, arrays) or "")) or key.replace("_", " ")
            summary_value = resolve(attribute(node, "summary"), strings, arrays)
            summary = clean(str(summary_value)) if isinstance(summary_value, str) else ""
            if summary in ("%s", ""):
                summary = ""
            kind = node.tag.removesuffix("PreferenceCompat").removesuffix("Preference")
            if node.tag == "SeekBarPreference":
                kind = "range"
            elif node.tag == "SwitchPreferenceCompat":
                kind = "switch"
            elif node.tag == "ListPreference":
                kind = "list"
            elif node.tag == "EditTextPreference":
                kind = "text"
            elif node.tag == "Preference":
                kind = "action"

            raw_default = attribute(node, "defaultValue")
            declared_default: object | None = resolve(raw_default, strings, arrays) if raw_default else None
            kotlin_value = kotlin_default(preference_source, key)
            default_raw: object | None = kotlin_value if kotlin_value is not None else declared_default
            if isinstance(default_raw, str):
                default_raw = clean(default_raw)

            entry_labels = resolve(attribute(node, "entries"), strings, arrays)
            entry_values = resolve(attribute(node, "entryValues"), strings, arrays)
            if isinstance(entry_labels, list):
                entry_labels = [resolve(str(value), strings, arrays) for value in entry_labels]
            if isinstance(entry_values, list):
                entry_values = [resolve(str(value), strings, arrays) for value in entry_values]
            options: list[dict[str, str]] = []
            if isinstance(entry_labels, list):
                if isinstance(entry_values, list):
                    options = [
                        {"label": str(label), "value": str(entry_values[index]) if index < len(entry_values) else str(label)}
                        for index, label in enumerate(entry_labels)
                    ]
                else:
                    options = [{"label": str(label), "value": str(label)} for label in entry_labels]
            minimum = attribute(node, "min")
            maximum = attribute(node, "max")
            increment = attribute(node, "seekBarIncrement")

            if kind == "switch":
                values = ["ON", "OFF"]
                purpose = summary or f"{title} の有効・無効を切り替えます。"
            elif kind == "range":
                values = [f"{minimum or '未指定'}〜{maximum or '未指定'}"]
                purpose = summary or f"{title} の値を調整します。"
            elif kind == "list":
                values = [option["label"] for option in options] or ["ソースに選択肢の宣言なし"]
                purpose = summary or f"選択肢から {title} を選びます。"
            elif kind == "text":
                values = ["テキスト入力"]
                purpose = summary or f"{title} にテキストを入力します。"
            elif kind == "action":
                values = ["専用画面を開く（保存値なし）"]
                purpose = summary or f"{title} の専用設定画面を開きます。"
            else:
                values = ["値はソースで確認できません"]
                purpose = summary or title

            default_display = key_for_default({"defaultRaw": default_raw, "options": options}, values)
            if kind == "action":
                default_display = "該当なし（設定画面を開く操作）"
            dependency_key = attribute(node, "dependency")
            source_file = path.name
            item = {
                "key": key,
                "title": title,
                "category": category or "その他",
                "group": category_for(source_file, category),
                "kind": kind,
                "purpose": purpose,
                "values": values,
                "options": options,
                "default": default_display,
                "range": {"min": minimum, "max": maximum, "step": increment},
                "edition": "Full only" if source_file in FULL_ONLY_RESOURCES else "Full and Lite",
                "dependency": dependency_key,
                "source": f"app/src/main/res/xml/{source_file}",
            }
            if key in DYNAMIC_DETAILS:
                item.update(DYNAMIC_DETAILS[key])
            if key in items:
                previous = items[key]
                previous_sources = previous.setdefault("alsoIn", [])
                if source_file not in previous_sources:
                    previous_sources.append(source_file)
                if previous.get("default") == "Not specified in the XML or AppPreference.kt" and default_display != previous.get("default"):
                    previous.update({"default": default_display, "values": values, "range": item["range"]})
                if not previous.get("purpose") or (not summary and len(purpose) > len(str(previous["purpose"]))):
                    previous["purpose"] = purpose
                continue
            items[key] = item

    return {
        "source": {
            "repository": "https://github.com/KazumaProject/JapaneseKeyboard",
            "commit": commit,
            "verifiedOn": "2026-09-25",
            "resources": [
                "app/src/main/res/xml/pref_*.xml",
                "app/src/main/java/com/kazumaproject/markdownhelperkeyboard/setting_activity/AppPreference.kt",
                "app/src/main/java/com/kazumaproject/markdownhelperkeyboard/ime_service/composing_guide/ComposingGuideSettings.kt",
                "app/src/main/java/com/kazumaproject/markdownhelperkeyboard/setting_activity/ui/setting/GemmaPreferenceFragment.kt",
                "app/src/main/java/com/kazumaproject/markdownhelperkeyboard/setting_activity/ui/setting/SplitKeyboardPreferenceFragment.kt",
                "app/src/main/java/com/kazumaproject/markdownhelperkeyboard/ime_service/state/KeyboardType.kt",
            ],
        },
        "items": list(items.values()),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_root", type=Path, help="Root of the Sumire Android repository")
    parser.add_argument("--commit", default="unknown", help="Source commit SHA")
    parser.add_argument("--output", type=Path, default=Path("data/settings.json"))
    args = parser.parse_args()
    data = build(args.source_root.resolve(), args.commit)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(data['items'])} distinct setting entries to {args.output}")


if __name__ == "__main__":
    main()
