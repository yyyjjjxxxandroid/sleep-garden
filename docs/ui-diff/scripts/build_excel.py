#!/usr/bin/env python3
"""Build an .xlsx with modification points and before/after screenshots (stdlib only)."""

from __future__ import annotations

import hashlib
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "疗愈UI修改点对照.xlsx"

# Each row maps to screenshot stems under before/ and after/
ROWS = [
    {
        "point": "重新规划页面信息层级",
        "desc": "明确定时、声音、场景和疗愈状态的主次关系",
        "priority": "P0",
        "before": "home-mobile.png",
        "after": "home-mobile.png",
        "note": "首页信息层级：修改前仅底部开始按钮；修改后底部主区含定时+开始",
    },
    {
        "point": "突出定时按钮",
        "desc": "将定时按钮放到页面最明显的位置，用户打开页面后可以快速找到",
        "priority": "P0",
        "before": "home-mobile.png",
        "after": "home-mobile.png",
        "note": "修改后首页底部「陪伴定时」chips 紧贴「开始」",
    },
    {
        "point": "重新设计定时区域",
        "desc": "集中放置时间选择、开始、暂停、继续、结束和重置功能",
        "priority": "P0",
        "before": "session-running.png",
        "after": "session-running.png",
        "note": "会话页 timer-actions：开始/暂停/重置/结束",
    },
    {
        "point": "重新设计声音区域",
        "desc": "将声音功能从定时区域中独立出来，避免用户误以为声音和定时是同一功能",
        "priority": "P1",
        "before": "session-running.png",
        "after": "session-running.png",
        "note": "修改后独立 sound-panel，与定时区分区",
    },
    {
        "point": "重新设计声音按钮",
        "desc": "明确显示当前声音、播放状态、音量或切换状态",
        "priority": "P1",
        "before": "sound-panel.png",
        "after": "sound-panel.png",
        "note": "修改后声音 chip 显示曲目与播放状态；音量仍在声音面板",
    },
    {
        "point": "优化按钮文字",
        "desc": "统一按钮命名，避免“开始”“进入”“播放”等含义相近的文字混乱",
        "priority": "P1",
        "before": "home-mobile.png",
        "after": "session-running.png",
        "note": "统一为：开始/暂停/继续/重置/结束/靠近小猫",
    },
    {
        "point": "优化按钮尺寸和间距",
        "desc": "保证桌面端和手机端都方便点击，不出现按钮重叠或过小的问题",
        "priority": "P0",
        "before": "home-mobile.png",
        "after": "home-mobile.png",
        "note": "点击区抬高至约 44–48px，间距统一",
    },
    {
        "point": "设计按钮状态",
        "desc": "统一默认、悬停、点击、禁用、运行中、暂停和完成状态",
        "priority": "P1",
        "before": "session-running.png",
        "after": "session-paused.png",
        "note": "修改后：进行中/已暂停 按钮文案与配色变化",
    },
    {
        "point": "优化进度条视觉效果",
        "desc": "清楚显示当前进度、剩余时间和疗愈状态",
        "priority": "P0",
        "before": "session-progress.png",
        "after": "session-progress.png",
        "note": "加高进度条 + 倒计时/已陪伴",
    },
    {
        "point": "增加疗愈状态提示",
        "desc": "明确显示“未开始、进行中、已暂停、已完成”等状态",
        "priority": "P0",
        "before": "session-running.png",
        "after": "session-paused.png",
        "note": "修改后状态徽标：进行中/已暂停/已完成",
    },
    {
        "point": "优化整体色彩",
        "desc": "使用符合疗愈主题的颜色，保证文字和按钮有足够对比度",
        "priority": "P1",
        "before": "home-mobile.png",
        "after": "home-mobile.png",
        "note": "疗愈绿主按钮、状态色与夜间配色对齐",
    },
    {
        "point": "优化页面响应式布局",
        "desc": "检查电脑、手机屏幕，避免内容溢出或遮挡",
        "priority": "P0",
        "before": "home-desktop.png",
        "after": "home-desktop.png",
        "note": "桌面端与手机端对照（同页不同宽度截图）",
    },
    {
        "point": "优化加载状态",
        "desc": "3D模型、声音或页面加载时显示合理的加载提示",
        "priority": "P1",
        "before": "loading.png",
        "after": "loading.png",
        "note": "bootLoader / 声音准备中提示",
    },
    {
        "point": "优化完成提示样式",
        "desc": "疗愈结束后显示明显但不过度打扰用户的完成反馈",
        "priority": "P1",
        "before": "result.png",
        "after": "result.png",
        "note": "结果弹层与完成反馈",
    },
    {
        "point": "交互检查",
        "desc": "确保所有页面的按钮点击后都能正常触发对应功能",
        "priority": "P0",
        "before": "session-running.png",
        "after": "session-running.png",
        "note": "会话页主操作区可点击对照（需人工再验）",
    },
]


def col_letter(n: int) -> str:
    s = ""
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def emu(px: int, dpi: int = 96) -> int:
    # pixels -> EMUs (English Metric Units), 914400 per inch
    return int(px * 914400 / dpi)


def build_xlsx(path: Path):
    before_dir = ROOT / "before"
    after_dir = ROOT / "after"

    # Prepare media list and row image mapping
    media: list[tuple[str, bytes]] = []  # (name, data)
    drawings = []  # (row_index_1based_data_row, before_media_idx|None, after_media_idx|None)

    def add_media(file_path: Path) -> int | None:
        if not file_path.exists():
            return None
        data = file_path.read_bytes()
        name = f"image{len(media)+1}.png"
        media.append((name, data))
        return len(media) - 1

    for i, row in enumerate(ROWS):
        b = add_media(before_dir / row["before"])
        a = add_media(after_dir / row["after"])
        drawings.append((i + 2, b, a))  # excel row (1 header)

    # Sheet dimensions
    img_w_px, img_h_px = 220, 420
    row_height_pt = img_h_px * 0.75  # approx

    # shared strings
    strings = ["修改点", "说明", "优先级", "备注", "修改前截图", "修改后截图"]
    for row in ROWS:
        for key in ("point", "desc", "priority", "note"):
            if row[key] not in strings:
                strings.append(row[key])

    def si(text: str) -> int:
        return strings.index(text)

    # sheet XML
    sheet_rows = [
        '<row r="1" ht="22" customHeight="1">'
        f'<c r="A1" t="s"><v>{si("修改点")}</v></c>'
        f'<c r="B1" t="s"><v>{si("说明")}</v></c>'
        f'<c r="C1" t="s"><v>{si("优先级")}</v></c>'
        f'<c r="D1" t="s"><v>{si("备注")}</v></c>'
        f'<c r="E1" t="s"><v>{si("修改前截图")}</v></c>'
        f'<c r="F1" t="s"><v>{si("修改后截图")}</v></c>'
        "</row>"
    ]
    for i, row in enumerate(ROWS):
        r = i + 2
        sheet_rows.append(
            f'<row r="{r}" ht="{row_height_pt:.2f}" customHeight="1">'
            f'<c r="A{r}" t="s"><v>{si(row["point"])}</v></c>'
            f'<c r="B{r}" t="s"><v>{si(row["desc"])}</v></c>'
            f'<c r="C{r}" t="s"><v>{si(row["priority"])}</v></c>'
            f'<c r="D{r}" t="s"><v>{si(row["note"])}</v></c>'
            f'<c r="E{r}"/><c r="F{r}"/>'
            "</row>"
        )

    sheet_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>
    <col min="1" max="1" width="28" customWidth="1"/>
    <col min="2" max="2" width="42" customWidth="1"/>
    <col min="3" max="3" width="8" customWidth="1"/>
    <col min="4" max="4" width="36" customWidth="1"/>
    <col min="5" max="5" width="34" customWidth="1"/>
    <col min="6" max="6" width="34" customWidth="1"/>
  </cols>
  <sheetData>
    {''.join(sheet_rows)}
  </sheetData>
  <drawing r:id="rId1"/>
</worksheet>
"""

    # drawing XML: one twoCellAnchor per image
    anchors = []
    pic_rels = []
    for idx, (excel_row, b_idx, a_idx) in enumerate(drawings):
        for col_idx, media_idx in ((4, b_idx), (5, a_idx)):  # 0-based col: E=4, F=5
            if media_idx is None:
                continue
            pic_id = len(anchors) + 1
            name = media[media_idx][0]
            rel_id = f"rId{pic_id}"
            pic_rels.append((rel_id, name))
            # place image roughly in cell
            from_col = col_idx
            to_col = col_idx + 1
            from_row = excel_row - 1
            to_row = excel_row
            anchors.append(
                f"""
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>{from_col}</xdr:col><xdr:colOff>9525</xdr:colOff>
      <xdr:row>{from_row}</xdr:row><xdr:rowOff>9525</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>{to_col}</xdr:col><xdr:colOff>0</xdr:colOff>
      <xdr:row>{to_row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:pic>
      <xdr:nvPicPr>
        <xdr:cNvPr id="{pic_id}" name="{escape(name)}"/>
        <xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr>
      </xdr:nvPicPr>
      <xdr:blipFill>
        <a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="{rel_id}"/>
        <a:stretch><a:fillRect/></a:stretch>
      </xdr:blipFill>
      <xdr:spPr>
        <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
      </xdr:spPr>
    </xdr:pic>
    <xdr:clientData/>
  </xdr:twoCellAnchor>"""
            )

    drawing_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
{''.join(anchors)}
</xdr:wsDr>
"""

    drawing_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
""" + "".join(
        f'<Relationship Id="{rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/{name}"/>\n'
        for rid, name in pic_rels
    ) + "</Relationships>"

    sheet_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>
"""

    sst = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="{c}" uniqueCount="{c}">
{items}
</sst>
""".format(
        c=len(strings),
        items="".join(f"<si><t>{escape(s)}</t></si>" for s in strings),
    )

    workbook = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="修改点对照" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>
"""
    workbook_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
"""
    styles = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders count="1"><border/></borders>
  <cellStyleXfs count="1"><xf/></cellStyleXfs>
  <cellXfs count="1"><xf xfId="0"/></cellXfs>
</styleSheet>
"""
    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>
</Types>
"""
    root_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>
"""

    if path.exists():
        path.unlink()
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types)
        z.writestr("_rels/.rels", root_rels)
        z.writestr("xl/workbook.xml", workbook)
        z.writestr("xl/_rels/workbook.xml.rels", workbook_rels)
        z.writestr("xl/styles.xml", styles)
        z.writestr("xl/sharedStrings.xml", sst)
        z.writestr("xl/worksheets/sheet1.xml", sheet_xml)
        z.writestr("xl/worksheets/_rels/sheet1.xml.rels", sheet_rels)
        z.writestr("xl/drawings/drawing1.xml", drawing_xml)
        z.writestr("xl/drawings/_rels/drawing1.xml.rels", drawing_rels)
        for name, data in media:
            z.writestr(f"xl/media/{name}", data)

    print(f"wrote {path} with {len(ROWS)} rows and {len(media)} images")


if __name__ == "__main__":
    build_xlsx(OUT)
