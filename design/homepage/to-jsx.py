# Converts the approved homepage (index.html, built by build.py) into a React component for apps/web.
# Usage: python3 design/homepage/to-jsx.py   (re-run after build.py; review the diff)
#
# What it does: body markup -> JSX (className, camelCase SVG attributes, style objects), Tailwind v3 -> v4
# class renames, Stitch-only tokens -> Clipwise tokens, links wired to real routes, and the waitlist form
# swapped for a "Create free account" button (sign-up is open). Motion stays in home-motion.ts (ported from motion.js).
import re
from html.parser import HTMLParser
from pathlib import Path

here = Path(__file__).parent
out = here.parent.parent / "apps/web/app/(marketing)/home-markup.tsx"

src = (here / "index.html").read_text()
b0 = src.index("<body")
body = src[src.index(">", b0) + 1 : src.index("<script src=", b0)]

CLASS_MAP = {
    # Stitch tokens -> explicit sizes (same values as the Stitch config)
    "text-body-md": "text-[14px]/[20px]",
    "text-body-sm": "text-[13px]/[18px]",
    "text-body-lg": "text-[16px]/[24px]",
    "text-label-sm": "text-[11px]/[14px] tracking-[0.02em] font-semibold",
    "text-headline-sm": "text-[18px]/[26px] tracking-[-0.01em] font-semibold",
    "text-headline-lg": "text-[32px]/[40px] tracking-[-0.02em] font-semibold",
    "md:px-margin-lg": "md:px-12",
    "font-sora": "font-heading",
    # Tailwind v3 -> v4 renames
    "shadow-sm": "shadow-xs",
    "shadow": "shadow-sm",
    "rounded": "rounded-[4px]",
    "rounded-sm": "rounded-[2px]",
    "bg-gradient-to-b": "bg-linear-to-b",
    "bg-gradient-to-r": "bg-linear-to-r",
    "placeholder-[#5C5C57]": "placeholder:text-[#5C5C57]",
    "focus:outline-none": "focus:outline-hidden",
}

ATTR_MAP = {
    "class": "className",
    "viewbox": "viewBox",
    "preserveaspectratio": "preserveAspectRatio",
    "for": "htmlFor",
}
VOID = {"input", "img", "br", "hr", "path", "circle", "line", "polygon", "polyline", "rect"}


def map_classes(cls: str) -> str:
    """Maps each class; a Stitch size token's weight/tracking yields to an explicit one on the same element."""
    own = cls.split()
    has_weight = any(re.fullmatch(r"font-(thin|light|normal|medium|semibold|bold|extrabold|black)", c) for c in own)
    has_tracking = any(c.startswith("tracking-") for c in own)
    mapped = []
    for c in own:
        for m in CLASS_MAP.get(c, c).split():
            if c in CLASS_MAP and ((m.startswith("font-") and m != "font-heading" and has_weight) or (m.startswith("tracking-") and has_tracking)):
                continue
            mapped.append(m)
    return " ".join(mapped)


def camel(name: str) -> str:
    if name.startswith(("data-", "aria-")):
        return name
    return ATTR_MAP.get(name, re.sub(r"-([a-z])", lambda m: m.group(1).upper(), name))


def style_obj(css: str) -> str:
    parts = []
    for decl in filter(None, (d.strip() for d in css.split(";"))):
        k, v = (x.strip() for x in decl.split(":", 1))
        parts.append(f'{camel(k)}: "{v}"')
    return "{{ " + ", ".join(parts) + " }}"


def link_target(href: str, text: str) -> str:
    text = " ".join(text.split())
    if href == "#" and text == "Sign in":
        return "/sign-in"
    if text == "Get started free":
        return "/sign-in?tab=sign-up"
    if href == "#":
        return "/"
    if href == "#pricing":
        return "#early-access"  # no pricing section in the beta
    return href


class ToJsx(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.out: list[str] = []
        self.skip = 0  # inside <form> (replaced) or <style>/<script>
        self.pending_a: list[tuple[int, dict]] = []

    def attrs_jsx(self, tag, attrs):
        res = []
        for k, v in attrs:
            if k == "onsubmit":
                continue
            if k == "class":
                v = map_classes(v or "")
            if k == "style":
                res.append(f"style={style_obj(v)}")
                continue
            if v is None or (k == "required" and v == ""):
                res.append(camel(k))
                continue
            res.append(f'{camel(k)}="{v}"')
        return (" " + " ".join(res)) if res else ""

    def handle_starttag(self, tag, attrs):
        if self.skip or tag in ("style", "script"):
            if tag in ("form", "style", "script"):
                self.skip += 1
            return
        if tag == "form":
            # Sign-up is open: the email form becomes a button to the Create account tab.
            self.out.append(
                '<a data-cta href="/sign-in?tab=sign-up" className="lime-glow inline-flex h-12 items-center justify-center '
                'rounded-xl bg-[#C6F432] px-6 font-heading text-[14px]/[20px] font-semibold text-[#0F0F0F] transition-all '
                'duration-150 hover:bg-[#B6E22A] active:scale-[0.98]">Create free account</a>'
            )
            self.skip += 1
            return
        if tag == "a":
            # href is fixed in handle_endtag once the link text is known
            self.pending_a.append((len(self.out), dict(attrs)))
        if tag == "svg":
            attrs = [*attrs, ("aria-hidden", "true")]  # every homepage SVG is decorative
        if tag == "button" and not any(k == "type" for k, _ in attrs):
            attrs = [*attrs, ("type", "button")]
        self.out.append(f"<{tag}{self.attrs_jsx(tag, attrs)}{' /' if tag in VOID else ''}>")

    def handle_startendtag(self, tag, attrs):
        if self.skip:
            return
        self.out.append(f"<{tag}{self.attrs_jsx(tag, attrs)} />")

    def handle_endtag(self, tag):
        if tag in ("form", "style", "script"):
            if self.skip:
                self.skip -= 1
            return
        if self.skip or tag in VOID:
            return
        if tag == "a" and self.pending_a:
            i, attrs = self.pending_a.pop()
            text = re.sub(r"<[^>]+>", "", "".join(self.out[i + 1 :]))
            old = attrs.get("href", "#")
            self.out[i] = self.out[i].replace(f'href="{old}"', f'href="{link_target(old, text)}"', 1)
        self.out.append(f"</{tag}>")

    def handle_data(self, data):
        if not self.skip:
            self.out.append(data.replace("{", "{'{'}").replace("}", "{'}'}"))

    def handle_entityref(self, name):
        if not self.skip:
            self.out.append(f"&{name};")

    def handle_comment(self, data):
        pass


p = ToJsx()
p.feed(body)
jsx = "".join(p.out)
jsx = re.sub(r"\n\s*\n+", "\n", jsx).strip()

# "Watch it work" is a <button> in the export; make it a link to the demo section.
jsx = re.sub(
    r'<button className="([^"]*)">(\s*<svg[^>]*>\s*<polygon points="5 3 19 12 5 21 5 3" />\s*</svg>\s*Watch it work\s*)</button>',
    r'<a href="#how-it-works" className="\1">\2</a>',
    jsx,
)

out.write_text(
    "// Generated by design/homepage/to-jsx.py from the approved Stitch homepage. Re-run it instead of hand-editing\n"
    "// the markup; motion lives in home-motion.ts.\n"
    "export function HomeMarkup() {\n  return (\n    <>\n"
    + jsx
    + "\n    </>\n  );\n}\n"
)
print(f"wrote {out.relative_to(here.parent.parent)} ({len(jsx)} chars)")
