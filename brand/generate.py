#!/usr/bin/env python3
"""github-hot-rank logo 候选生成器（可复现）。

Token（性质标注）：
- primary #0969da —— 项目既有：entrypoints/popup/index.html:13,16（tab 激活/名次色，GitHub 蓝）
- accent  #1a7f37 —— 项目既有：entrypoints/popup/index.html:18（涨幅绿色 .delta）
- 无新增色；深浅底同版可用（darkAsset=null），依据见 brand/manifest.json。

候选：
- A Δ星：涨幅度量符号 Δ 内挖负空间五角星（Δ1/Δ7 是产品核心度量，star 是被排名的货币）。
- B 新星轨迹：主星沿上升弧拖出渐小星尾（"按涨幅排新星"，新星诞生的轨迹）。
- C 突变尖峰 v2：星的上尖拉长成增速尖峰，尖峰沿轴断开，尖端段填突变提醒绿（绿色并入尖峰本体，无漂浮元素）。
"""
import math
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SVG = ROOT / "svg"
PNG = ROOT / "png"
for d in (SVG, PNG, ROOT / "screenshots"):
    d.mkdir(parents=True, exist_ok=True)

PRIMARY = "#0969da"
ACCENT = "#1a7f37"


def star_pts(cx: float, cy: float, ro: float, ratio: float = 0.4) -> list[tuple[float, float]]:
    """五角星顶点序列（外-内交替，起于正上方外点）。"""
    ri = ro * ratio
    pts = []
    for k in range(5):
        a_out = math.radians(-90 + k * 72)
        a_in = math.radians(-90 + k * 72 + 36)
        pts.append((cx + ro * math.cos(a_out), cy + ro * math.sin(a_out)))
        pts.append((cx + ri * math.cos(a_in), cy + ri * math.sin(a_in)))
    return pts


def path_of(pts) -> str:
    return "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts) + " Z"


def svg(title: str, label: str, body: str) -> str:
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" '
        f'aria-label="{label}">\n  <title>{title}</title>\n{body}\n</svg>\n'
    )


# ---------- A：Δ星（负空间） ----------
tri = [(128, 40), (218, 208), (38, 208)]
hole = star_pts(128, 152, 44)
tri_d = path_of(tri)
hole_d = path_of(hole)
svg_a = svg(
    "Δ星", "涨幅三角与负空间星",
    f'  <path fill-rule="evenodd" fill="{PRIMARY}" d="{tri_d} {hole_d}"/>',
)

# ---------- B：新星轨迹 ----------
main = star_pts(138, 128, 58)
tail1 = star_pts(72, 180, 26)
tail2 = star_pts(36, 216, 14)
svg_b = svg(
    "新星轨迹", "主星沿上升弧拖出渐小星尾",
    f'  <path fill="{PRIMARY}" fill-opacity="0.3" d="{path_of(tail2)}"/>\n'
    f'  <path fill="{PRIMARY}" fill-opacity="0.55" d="{path_of(tail1)}"/>\n'
    f'  <path fill="{PRIMARY}" d="{path_of(main)}"/>',
)

# ---------- C：突变尖峰 v2（按盲审修复：绿色并入尖峰本体） ----------
c, ro, ri = (120, 152), 54, 21.6
inner = []
for k in range(5):
    a = math.radians(-90 + k * 72 + 36)
    inner.append((c[0] + ri * math.cos(a), c[1] + ri * math.sin(a)))
# 内点角：-54,18,90,162,234 → i0..i4
spike = (196, 44)
# 右臂收短 12%（r=47.5）：让主尖峰成为唯一长轴（盲审 r2 打磨建议 2）
o_right = (c[0] + 47.5 * math.cos(math.radians(-18)), c[1] + 47.5 * math.sin(math.radians(-18)))
o_lr = (c[0] + ro * math.cos(math.radians(54)), c[1] + ro * math.sin(math.radians(54)))
o_ll = (c[0] + ro * math.cos(math.radians(126)), c[1] + ro * math.sin(math.radians(126)))
o_left = (c[0] + ro * math.cos(math.radians(198)), c[1] + ro * math.sin(math.radians(198)))
b1, b2 = (136, 142), (104, 142)  # 尖峰基部两点
# 星体（不含尖峰）：从 b1 绕右侧/下方/左侧回 b2
pts_body = [b1, o_right, inner[1], o_lr, inner[2], o_ll, inner[3], o_left, b2]
# 尖峰沿轴在 45% 处断开 4.5 单位（r2 收窄 36%）→ 上段为绿色「突变段」
# 轴向 unit=(0.613,-0.790)；切点：下缘 (140.2,103.7)/(153.0,113.7)，上缘 (143.0,100.1)/(155.8,110.1)
spike_low = [b1, (153.0, 113.7), (140.2, 103.7), b2]
spike_high = [(143.0, 100.1), spike, (155.8, 110.1)]
svg_c = svg(
    "突变尖峰", "上尖断开成绿色突变段的星",
    f'  <path fill="{PRIMARY}" d="{path_of(pts_body)} {path_of(spike_low)}"/>\n'
    f'  <path fill="{ACCENT}" d="{path_of(spike_high)}"/>',
)

# ---------- 落盘 ----------
(SVG / "a-delta-star.svg").write_text(svg_a)
(SVG / "b-nova-trail.svg").write_text(svg_b)
(SVG / "c-mutation-spike.svg").write_text(svg_c)

# ---------- 渲染 + alpha 检查 ----------
from PIL import Image

def render(name: str, size: int, bg: str | None) -> Image.Image:
    src = SVG / f"{name}.svg"
    out = PNG / f"{name}-{size}{'-' + bg.lstrip('#') if bg else ''}.png"
    args = ["rsvg-convert", "-w", str(size), "-h", str(size), str(src), "-o", str(out)]
    if bg:
        args = ["rsvg-convert", "-w", str(size), "-h", str(size),
                "--background-color", bg, str(src), "-o", str(out)]
    subprocess.run(args, check=True)
    return Image.open(out).convert("RGBA")

def alpha_check(img: Image.Image, tag: str) -> None:
    w, h = img.size
    corners = [img.getpixel(p)[3] for p in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]]
    bbox = img.getbbox()  # 含 alpha 的包围盒
    assert all(a == 0 for a in corners), f"{tag} 角落不透明: {corners}"
    assert bbox and bbox[2] - bbox[0] > w * 0.3 and bbox[3] - bbox[1] > h * 0.3, f"{tag} 主体过小: {bbox}"
    print(f"{tag}: 角透明 {corners} · bbox={bbox} · size={w}x{h}")

for name in ("a-delta-star", "b-nova-trail", "c-mutation-spike"):
    alpha_check(render(name, 512, None), name)
    render(name, 32, "#FFFFFF")
    render(name, 32, "#0D1117")

# ---------- 拼评审板：编号 + 大图 + 48/24px ----------
def on_white(img: Image.Image) -> Image.Image:
    white = Image.new("RGBA", img.size, (255, 255, 255, 255))
    return Image.alpha_composite(white, img)

sheet = Image.new("RGBA", (1200, 560), (255, 255, 255, 255))
names = ["a-delta-star", "b-nova-trail", "c-mutation-spike"]
for i, name in enumerate(names):
    x0 = 20 + i * 395
    sheet.alpha_composite(on_white(render(name, 260, None)), (x0 + 60, 30))
    s48 = render(name, 48, None)
    s24 = render(name, 24, None)
    sheet.alpha_composite(on_white(s48), (x0 + 90, 330))
    sheet.alpha_composite(on_white(s24), (x0 + 160, 342))
    # 24px 深底小样
    d24 = render(name, 24, "#0D1117")
    sheet.alpha_composite(d24, (x0 + 210, 342))
    from PIL import ImageDraw
    ImageDraw.Draw(sheet).text((x0 + 60, 300), f"#{i+1} {name}  (48px / 24px / 24px-dark)", fill=(40, 40, 40, 255))
sheet_path = ROOT / "screenshots" / "contact-sheet.png"
sheet_path.parent.mkdir(exist_ok=True)
sheet.save(sheet_path)
print(f"评审板: {sheet_path}")
