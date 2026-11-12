"""Gera dist/mesa-viva.html: um único arquivo com CSS, JS e artes embutidas (fácil de mandar para os amigos ou hospedar)."""
import base64, json, os, re

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

def inline(m):
    data = base64.b64encode(open(p("assets", m.group(1) + ".webp"), "rb").read()).decode()
    return "data:image/webp;base64," + data
html = re.sub(r"assets/([\w/]+)\.webp(?:\?v=[\w.-]+)?", inline, html)  # "?v=" nas imagens só serve para o cache
# sons (.ogg) também vão embutidos
html = re.sub(r"assets/(\w+)\.ogg", lambda m: "data:audio/ogg;base64," + base64.b64encode(open(p("assets", m.group(1) + ".ogg"), "rb").read()).decode(), html)

os.makedirs(p("dist"), exist_ok=True)
open(p("dist", "mesa-viva.html"), "w", encoding="utf-8").write(html)
print("dist/mesa-viva.html", os.path.getsize(p("dist", "mesa-viva.html")) // 1024, "KB")
