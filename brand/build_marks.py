#!/usr/bin/env python3
"""生成 github-hot-rank 的标志候选（几何由本脚本生成，可复现）。

设计前提（来自产品本身，不从既有代码反推）：
- 「追榜单的火苗」：火焰是热榜的视觉语言，也是本产品的核心动作（增速/热度）。
- 「星星标的黄色」：GitHub 的 star 徽章形状 + 其黄色 #e3b341（产品对象本身）。
- 两个语义合成一个剪影，而不是并排两个图形。

用法：python3 brand/build_marks.py
输出：brand/svg/<name>.svg
"""

import math
import pathlib

OUT = pathlib.Path(__file__).resolve().parent / "svg"

FLAME = "#f0883e"   # 榜单火苗橙（Primer attention orange）
STAR = "#e3b341"    # GitHub star 徽章黄（--button-star-iconColor）


def star_points(cx, cy, outer, inner, rot=-90.0, n=5):
    """实心五角星轮廓点列（10 个顶点）。"""
    pts = []
    for i in range(2 * n):
        r = outer if i % 2 == 0 else inner
        a = math.radians(rot + i * (180.0 / n))
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def star_path(cx, cy, outer, inner, rot=-90.0):
    p = star_points(cx, cy, outer, inner, rot)
    d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in p) + " Z"
    return d


def flame_path(scale=1.0, dx=0.0, dy=0.0):
    """手绘火焰轮廓：左侧内凹舌、右侧外鼓、顶部右勾。

    坐标基于 256 画布，scale/dx/dy 用于缩放平移（不改变比例关系）。
    """
    pts = [
        ("M", 116.0, 238.0),
        ("C", 84.0, 238.0, 58.0, 214.0, 58.0, 180.0),
        ("C", 58.0, 150.0, 74.0, 130.0, 88.0, 114.0),
        ("C", 96.0, 104.0, 100.0, 94.0, 98.0, 82.0),
        ("C", 112.0, 94.0, 116.0, 108.0, 112.0, 122.0),
        ("C", 128.0, 108.0, 136.0, 90.0, 138.0, 70.0),
        ("C", 140.0, 52.0, 138.0, 38.0, 150.0, 22.0),
        ("C", 166.0, 38.0, 178.0, 60.0, 182.0, 84.0),
        ("C", 186.0, 110.0, 198.0, 126.0, 198.0, 152.0),
        ("C", 198.0, 200.0, 168.0, 238.0, 116.0, 238.0),
        ("Z", 0.0, 0.0),
    ]
    out = []
    for seg in pts:
        k = seg[0]
        if k == "Z":
            out.append("Z")
            continue
        nums = seg[1:]
        mapped = []
        for i, v in enumerate(nums):
            if i % 2 == 0:
                mapped.append(f"{v * scale + dx:.1f}")
            else:
                mapped.append(f"{v * scale + dy:.1f}")
        out.append(k + " " + " ".join(mapped))
    return " ".join(out)


def svg(body, title, aria, size=256):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" '
        f'role="img" aria-label="{aria}">\n'
        f"  <title>{title}</title>\n{body}\n</svg>\n"
    )


def v1_flame_star():
    """焰中星：橙色火焰剪影，腹部镂空一颗五角星（负空间里藏新星）。"""
    flame = flame_path()
    hole = star_path(124.0, 172.0, 52.0, 24.0, rot=-98.0)
    body = (
        f'  <path fill="{FLAME}" fill-rule="evenodd" d="{flame} {hole}"/>'
    )
    return svg(body, "GitHub Hot Rank · 焰中星", "GitHub Hot Rank 标志：火焰中藏一颗星")


def v2_burning_star():
    """燃星：金色星徽打底，橙色火苗从星尖后面升起（两色叠压）。"""
    star = star_path(128.0, 152.0, 88.0, 39.0, rot=-90.0)
    flame = flame_path(scale=0.55, dx=57.6, dy=37.9)
    body = (
        f'  <path fill="{FLAME}" d="{flame}"/>\n'
        f'  <path fill="{STAR}" d="{star}"/>'
    )
    return svg(body, "GitHub Hot Rank · 燃星", "GitHub Hot Rank 标志：燃烧的星")


def v4_flame_star_twin():
    """焰星双色：橙色火苗 + 金色实心星，星尖破出火焰轮廓。"""
    flame = flame_path()
    star = star_path(116.0, 166.0, 58.0, 27.0, rot=-96.0)
    body = (
        f'  <path fill="{FLAME}" d="{flame}"/>\n'
        f'  <path fill="{STAR}" d="{star}"/>'
    )
    return svg(body, "GitHub Hot Rank · 焰星", "GitHub Hot Rank 标志：火焰托起一颗星")


def v3_flame_crown():
    """焰冠星：单一剪影，金色——星的上尖被火苗取代（同色融合为一个形）。"""
    star = star_path(128.0, 156.0, 86.0, 38.0, rot=-90.0)
    crown = flame_path(scale=0.62, dx=48.5, dy=44.6)
    body = (
        f'  <path fill="{STAR}" d="{star}"/>\n'
        f'  <path fill="{STAR}" d="{crown}"/>'
    )
    return svg(body, "GitHub Hot Rank · 焰冠星", "GitHub Hot Rank 标志：带火冠的星")


def v5_flame_star_halo():
    """焰中星（双色）：火焰里嵌一颗金色星，星与火之间留一圈透空让它分离。"""
    flame = flame_path()
    halo = star_path(122.0, 168.0, 64.0, 30.0, rot=-96.0)
    gold = star_path(122.0, 168.0, 56.0, 26.0, rot=-96.0)
    body = (
        f'  <path fill="{FLAME}" fill-rule="evenodd" d="{flame} {halo}"/>\n'
        f'  <path fill="{STAR}" d="{gold}"/>'
    )
    return svg(body, "GitHub Hot Rank · 焰中星（双色）", "GitHub Hot Rank 标志：火焰中嵌一颗金色星")


def star_vertices(cx, cy, outer, inner, rot=-90.0):
    """五角星的 10 个顶点（偶数索引为外点，奇数为内点）。"""
    pts = []
    for i in range(10):
        a = math.radians(rot + i * 36.0)
        rad = outer if i % 2 == 0 else inner
        pts.append((cx + rad * math.cos(a), cy + rad * math.sin(a)))
    return pts


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def poly_path(pts):
    return "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts) + " Z"


def flame_segs_cradle():
    """摇篮火焰：顶部左右分叉、中间下凹成一个 V 口，正好让金星顶进缺口。"""
    return [
        ("M", (104.0, 234.0)),
        ("C", (72.0, 234.0), (50.0, 210.0), (50.0, 180.0)),
        ("C", (50.0, 150.0), (64.0, 130.0), (78.0, 114.0)),
        ("C", (88.0, 102.0), (93.0, 88.0), (91.0, 74.0)),
        ("C", (102.0, 90.0), (107.0, 108.0), (103.0, 124.0)),
        ("C", (110.0, 142.0), (119.0, 150.0), (128.0, 150.0)),
        ("C", (138.0, 150.0), (147.0, 140.0), (151.0, 122.0)),
        ("C", (157.0, 98.0), (159.0, 72.0), (157.0, 50.0)),
        ("C", (172.0, 44.0), (182.0, 64.0), (184.0, 94.0)),
        ("C", (191.0, 124.0), (202.0, 150.0), (202.0, 180.0)),
        ("C", (202.0, 212.0), (188.0, 234.0), (168.0, 234.0)),
        ("Z", ()),
    ]


def segs_path(segs):
    """segs: [("M", pt), ("C", p1, p2, p3), ("Z",)] → SVG path 片段。"""
    out = []
    for seg in segs:
        cmd = seg[0]
        if cmd == "Z":
            out.append("Z")
            continue
        pts = seg[1:]
        out.append(cmd + " " + " ".join(f"{x:.1f},{y:.1f}" for x, y in pts))
    return " ".join(out)


def v6_forged_star_in_flame():
    """锻口金星入焰：橙色火焰里一颗金星，上尖被斜切成锻打的平面。"""
    cx, cy, R, r = 130.0, 178.0, 50.0, 23.0
    v = star_vertices(cx, cy, R, r)
    apex = v[0]
    p_left = lerp(v[9], apex, 0.18)   # 左刃切得低
    p_right = lerp(apex, v[1], 0.60)  # 右刃切得高，形成斜面
    outline = [p_left, p_right] + v[1:10]
    body = (
        f'  <path fill="{FLAME}" d="{flame_path()}"/>\n'
        f'  <path fill="{STAR}" d="{poly_path(outline)}"/>'
    )
    return svg(body, "GitHub Hot Rank · 锻星入焰", "GitHub Hot Rank 标志：火苗中一颗被锻口的新星")


def v7_flame_tip_star():
    """焰尖金身：一颗金星，上尖直接烧成火舌——同一个剪影，两种产品色。

    盲审二轮修复（评审几何建议）：
    - 接缝：火与星共用同一条浅凹弧（凹向星体），火舌坐在凹弧里，台阶从根上消失；
    - 火舌尖部钝化：圆头收尾，尖端保持宽度，不再是凹弧收尖的 1px 脏点；
    - 火舌根部加宽（约 13-14% 标记宽），左缘外鼓、右缘内凹回落。
    """
    cx, cy, R, r = 128.0, 168.0, 72.0, 33.0
    v = star_vertices(cx, cy, R, r)
    lb, rb = v[9], v[1]  # 左右肩点（apex 由火舌取代）
    # 共享接缝：肩点间浅凹弧（凹向星体内部约 5px）
    seam_fwd = f"C 118.0,134.0 138.0,134.0 {rb[0]:.1f},{rb[1]:.1f}"
    seam_rev = f"C 138.0,134.0 118.0,134.0 {lb[0]:.1f},{lb[1]:.1f}"
    tongue = [
        f"M {lb[0]:.1f},{lb[1]:.1f}",
        "C 96.0,124.0 106.0,104.0 120.0,86.0",    # 左缘外鼓上升
        "C 128.0,76.0 134.0,66.0 138.0,56.0",     # 逼近钝尖
        "C 141.0,48.0 147.0,42.0 154.0,44.0",     # 圆头左半
        "C 161.0,46.0 163.0,54.0 159.0,62.0",     # 圆头右半（尖端保持 ~12px 宽）
        "C 155.0,80.0 150.0,110.0 " + f"{rb[0]:.1f},{rb[1]:.1f}",  # 右缘内凹回落
        seam_rev,
        "Z",
    ]
    star_body = (
        f"M {rb[0]:.1f},{rb[1]:.1f} "
        + " L".join(f"{x:.1f},{y:.1f}" for x, y in v[2:10])
        + f" {seam_fwd} Z"
    )
    body = (
        f'  <path fill="{STAR}" d="{star_body}"/>\n'
        f'  <path fill="{FLAME}" d="{" ".join(tongue)}"/>'
    )
    return svg(body, "GitHub Hot Rank · 焰尖金身", "GitHub Hot Rank 标志：一颗尖上燃着火的星")


def v7_small_flame_cap():
    """16px 专属变体（颜色分割，不从大稿缩放）：完整五角星剪影，
    顶部约 22% 高度填火苗橙——用颜色承载「尖在烧」，放弃在 1px 尺度用形状承载。"""
    cx, cy, R, r = 128.0, 160.0, 76.0, 34.0
    v = star_vertices(cx, cy, R, r)
    apex = v[0]
    star = poly_path(v)
    # 顶部橙帽：从左肩(146°方向的肩点)沿星缘到 apex 再到右肩的三角区
    cap = (
        f"M {v[9][0]:.1f},{v[9][1]:.1f} L {apex[0]:.1f},{apex[1]:.1f} "
        f"L {v[1][0]:.1f},{v[1][1]:.1f} L {cx:.1f},{cy - 0.35 * R:.1f} Z"
    )
    body = (
        f'  <path fill="{STAR}" d="{star}"/>\n'
        f'  <path fill="{FLAME}" d="{cap}"/>'
    )
    return svg(body, "GitHub Hot Rank · 焰尖金身（小尺寸）", "GitHub Hot Rank 小尺寸标志：金色星，顶部燃橙")


def v8_flame_cradles_star():
    """焰口托星：火焰顶端开一个 V 口，金星顶进去，两个形体咬合成一个剪影。"""
    cx, cy, R, r = 128.0, 186.0, 46.0, 21.0
    v = star_vertices(cx, cy, R, r)
    star = poly_path(v)
    body = (
        f'  <path fill="{FLAME}" d="{segs_path(flame_segs_cradle())}"/>\n'
        f'  <path fill="{STAR}" d="{star}"/>'
    )
    return svg(body, "GitHub Hot Rank · 焰口托星", "GitHub Hot Rank 标志：火焰托起一颗新星")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    files = {
        "v1-flame-star.svg": v1_flame_star(),
        "v2-burning-star.svg": v2_burning_star(),
        "v3-flame-crown.svg": v3_flame_crown(),
        "v4-flame-star-twin.svg": v4_flame_star_twin(),
        "v5-flame-star-halo.svg": v5_flame_star_halo(),
        "v6-forged-star-in-flame.svg": v6_forged_star_in_flame(),
        "v7-flame-tip-star.svg": v7_flame_tip_star(),
        "v7-small-flame-cap.svg": v7_small_flame_cap(),
        "v8-flame-cradles-star.svg": v8_flame_cradles_star(),
    }
    for name, content in files.items():
        p = OUT / name
        p.write_text(content, encoding="utf-8")
        print(f"wrote {p}")


if __name__ == "__main__":
    main()
