"""Gera dist/mesa-viva.html: um único arquivo com CSS, JS e artes embutidas (fácil de mandar para os amigos ou hospedar)."""
import base64, json, os, re
from pathlib import Path
from functools import lru_cache

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
p = lambda *a: os.path.join(ROOT, *a)
html = open(p("index.html"), encoding="utf-8").read()

# os endereços levam "?v=versão" (para o navegador não misturar arquivos velhos e novos depois de uma atualização)
html = re.sub(r'<link rel="stylesheet" href="style\.css(?:\?[^"]*)?">', lambda m: "<style>\n" + open(p("style.css"), encoding="utf-8").read() + "\n</style>", html)
html = re.sub(r'<script src="(js/[\w.-]+)(?:\?[^"]*)?"></script>', lambda m: "<script>\n" + open(p(m.group(1)), encoding="utf-8").read() + "\n</script>", html)

# Última roda num iframe. O arquivo único leva a mesma mesa e o mesmo motor da
# página principal; buscar o iframe publicado poderia misturar versões de regras.
ult = open(p("prototipos", "ultima", "index.html"), encoding="utf-8").read()
ult = ult.replace('<head>', '<head><base href="https://guicalheira.github.io/mesa-viva/prototipos/ultima/">', 1)
ult_css = open(p("prototipos", "ultima", "style.css"), encoding="utf-8").read()
ult = re.sub(r'<script>const V = .*?</script>', lambda m: '<style>' + ult_css + '</style><script>const V = "embedded";</script>', ult, flags=re.S)
ult_scripts = []
for f in [p("js", "ultima.js"), *[p("prototipos", "ultima", name + ".js") for name in ["art", "audio", "scene", "ui"]]]:
    code = open(f, encoding="utf-8").read().replace('</script', '<\\/script')
    ult_scripts.append('<script>\n' + code + '\n</script>')
ult = re.sub(r'<script>for \(const f of .*?</script>', lambda m: '\n'.join(ult_scripts), ult, flags=re.S)
embedded = json.dumps(ult, ensure_ascii=True).replace('</', '<\\/')
html = html.replace('const EMBEDDED = null;', 'const EMBEDDED = ' + embedded + ';', 1)

# As duas edições do Patrimônio levam a mesa e os dados desta mesma versão.
pat = open(p("prototipos", "patrimonio", "index.html"), encoding="utf-8").read()
pat = pat.replace('<head>', '<head><base href="https://guicalheira.github.io/mesa-viva/prototipos/patrimonio/">', 1)
pat_css = open(p("prototipos", "patrimonio", "style.css"), encoding="utf-8").read()
pat_boot = '<style>' + pat_css + '</style><script>const V = "embedded"; const ED2 = document.documentElement.dataset.edition === "2"; if (ED2) { document.title = "Patrimônio 2.0"; addEventListener("DOMContentLoaded", () => document.querySelector(".wordmark").textContent = "Patrimônio 2.0"); }</script>'
pat = re.sub(r'<script>const V = .*?</script>', lambda m: pat_boot, pat, flags=re.S)
pat_scripts = []
for f in [*[p("js", name + ".js") for name in ["pat-data", "pat2-data", "pat-engine"]], *[p("prototipos", "patrimonio", name + ".js") for name in ["art", "audio", "scene", "ui"]]]:
    code = open(f, encoding="utf-8").read()
    if f.endswith('art.js'):
        photo_names = re.search(r"PHOTO_FOCUS = Object.fromEntries\('([^']+)'", code).group(1).split()
        photos = {}
        for name in photo_names:
            ext = 'png' if os.path.exists(p("prototipos", "patrimonio", "img", name + '.png')) else 'jpg'
            data = open(p("prototipos", "patrimonio", "img", name + '.' + ext), 'rb').read()
            photos[name] = 'data:image/' + ('jpeg' if ext == 'jpg' else 'png') + ';base64,' + base64.b64encode(data).decode()
        code = code.replace('const EMBEDDED_PHOTOS = null;', 'const EMBEDDED_PHOTOS = ' + json.dumps(photos) + ';', 1)
    code = code.replace('</script', '<\\/script')
    if f.endswith('pat2-data.js'):
        code = code.replace('`img/cards/${c.id}.svg`', "'data:image/svg+xml;base64,' + ({" + ','.join(json.dumps(f.stem) + ':' + json.dumps(base64.b64encode(f.read_bytes()).decode()) for f in sorted(Path(p('prototipos', 'patrimonio', 'img', 'cards')).glob('*.svg'))) + "})[c.id]")
    pat_scripts.append('<script>\n' + code + '\n</script>')
    if f.endswith('pat2-data.js'):
        pat_scripts.append('<script>if (ED2) window.PD = window.PD2;</script>')
pat = re.sub(r'<script>for \(const f of .*?</script>', lambda m: '\n'.join(pat_scripts), pat, flags=re.S)
pat_embedded = json.dumps(pat, ensure_ascii=True).replace('</', '<\\/')
html = html.replace('const PAT_EMBEDDED = null;', 'const PAT_EMBEDDED = ' + pat_embedded + ';', 1)

@lru_cache(maxsize=None)
def inline_asset(name):
    data = base64.b64encode(open(p("assets", name + ".webp"), "rb").read()).decode()
    return "data:image/webp;base64," + data

def inline(m):
    return inline_asset(m.group(1))
html = re.sub(r"assets/([\w/]+)\.webp(?:\?v=[\w.-]+)?", inline, html)  # "?v=" nas imagens só serve para o cache
# sons (.ogg) também vão embutidos
@lru_cache(maxsize=None)
def inline_audio(name):
    return "data:audio/ogg;base64," + base64.b64encode(open(p("assets", name + ".ogg"), "rb").read()).decode()
html = re.sub(r"assets/(\w+)\.ogg", lambda m: inline_audio(m.group(1)), html)

os.makedirs(p("dist"), exist_ok=True)
open(p("dist", "mesa-viva.html"), "w", encoding="utf-8").write(html)
print("dist/mesa-viva.html", os.path.getsize(p("dist", "mesa-viva.html")) // 1024, "KB")
