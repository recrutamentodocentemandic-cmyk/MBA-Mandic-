# Conteúdo do curso (base do Q&A)

Coloque aqui os materiais de cada disciplina em Markdown, um arquivo por capítulo/aula,
com frontmatter de metadados. Esses metadados são o que permite ao bot **apontar a seção
específica** do conteúdo na resposta — sem eles a citação não existe.

```markdown
---
modulo: M02
fonte: livro            # livro | aula | artigo
titulo: "Estratégia Competitiva"
capitulo: "Cap. 1 — O que é estratégia"
---

Texto do capítulo ou transcrição da aula...
```

Convenção de nome: `M02-livro-cap01.md`, `M02-aula-03.md`.

Os arquivos de conteúdo são ignorados pelo git (direito autoral — o material não vai
para o GitHub). No Railway, suba-os junto com o deploy ou monte um volume.
