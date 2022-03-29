import dedent from 'dedent'
import unified from 'unified'
import reParse from 'remark-parse'
import stringify from 'rehype-stringify'
import remarkStringify from 'remark-stringify'
import remark2rehype from 'remark-rehype'
import xtend from 'xtend'
import plugin from '../src/'

const defaultConfig = {
  secret: {
    classes: 'spoiler',
  },
  s: {
    classes: 'spoiler',
  },
  information: {
    classes: 'information ico-after',
  },
  i: {
    classes: 'information ico-after',
  },
  question: {
    classes: 'question ico-after',
  },
  q: {
    classes: 'question ico-after',
  },
  attention: {
    classes: 'warning ico-after',
  },
  a: {
    classes: 'warning ico-after',
  },
  erreur: {
    classes: 'error ico-after',
  },
  e: {
    classes: 'error ico-after',
  },
  neutre: {
    classes: 'neutral foo',
    title: 'required',
  },
  customizableBlock: {
    classes: 'neutral foo',
    title: 'optional',
  },
  details: {
    classes: 'spoiler',
    title: 'optional',
    details: true,
  },
  defaultTitle: {
    classes: 'defaultTitle',
    title: 'optional',
    defaultTitle: 'Anything you want',
  },
}

const render = (text, allowTitle, config) => {
  const realConfig = xtend(Object.assign({}, defaultConfig), config)

  return unified()
    .use(reParse)
    .use(remark2rehype)
    .use(plugin, realConfig, allowTitle)
    .use(stringify)
    .processSync(text)
}

const renderToMarkdown = (text) => unified()
  .use(reParse)
  .use(remarkStringify)
  .use(plugin, Object.assign({}, defaultConfig))
  .processSync(text)

const fixture = dedent`
  [[s]]
  | Secret Block

  [[s]]
  |Secret Block

  [[secret]]
  | another

  > [[s]]
  > | > Blockquote in secret block in blockquote

  [[i]]
  | Information Block

  [[information]]
  | another

  [[q]]
  | Question Block

  [[question]]
  | another

  [[a]]
  | Attention Block

  [[attention]]
  | another

  [[e]]
  | Erreur Block

  [[erreur]]
  | another

  [[se]]
  | not a block

  [[secretsecret]]
  | not a block

  [[SECRET]]
  | not a block

  [[s]]
  | Multiline block
  |
  | > with blockquote !

  | Not a block

  [[attention | title]]
  | not parsed
`

test('Common', () => {
  const {contents} = render(fixture)
  expect(contents).toMatchSnapshot()
})

test('title is required', () => {
  const {contents} = render(dedent`
    [[neutre]]
    | no

    [[neutre|my title]]
    | yes

    [[neutre |  my **title**]]
    | yes
  `)
  expect(contents).toMatchSnapshot()
})

test('title is optional', () => {
  const {contents} = render(dedent`
    [[customizableBlock]]
    | yes

    [[customizableBlock    | my <i>tïtle</i>]]
    | yes
  `)
  expect(contents).toMatchSnapshot()
})

test('details', () => {
  const {contents} = render(dedent`
    [[details| my title]]
    | content
  `)

  expect(contents).toBe(dedent`
    <details class="custom-block spoiler">\
    <summary class="custom-block-heading">my title</summary>\
    <div class="custom-block-body"><p>content</p></div>\
    </details>`)
})

test('Errors without config', () => {
  const fail = () => unified()
    .use(reParse)
    .use(remark2rehype)
    .use(plugin)
    .use(stringify)
    .processSync('')

  expect(fail).toThrowError(Error)
})

test('regression 1', () => {
  const {contents} = render(dedent`
    content before
    [[s]]
    |Block
    with content after
  `)
  expect(contents).toMatchSnapshot()
})

test('regression 2', () => {
  const {contents} = render(dedent`
    [[information]][titre]
    | test
  `)
  expect(contents).toMatchSnapshot()
})

test('compile fixture to markdown', () => {
  const {contents} = renderToMarkdown(fixture)
  expect(contents).toMatchSnapshot()
  const result = renderToMarkdown(contents)
  expect(result.contents).toBe(contents)
})

test('compile regression1 to markdown', () => {
  const {contents} = renderToMarkdown(dedent`
    content before
    [[s]]
    |Block
    with content after
  `)
  expect(contents).toMatchSnapshot()
  const result = renderToMarkdown(contents)
  expect(result.contents).toBe(contents)
})

test('compile titled block to markdown', () => {
  const {contents} = renderToMarkdown(dedent`
    [[details| **my** title]]
    | content
  `)

  expect(contents).toMatchSnapshot()
  const result = renderToMarkdown(contents)
  expect(result.contents).toBe(contents)
})

test('compile multiline block to markdown', () => {
  const fixture = dedent`
    [[information]]
    | content
    | > blockquote
    |
    | simple paragraph
  `
  const {contents} = renderToMarkdown(fixture)

  expect(contents).toMatchSnapshot()
  const result = renderToMarkdown(contents)
  expect(result.contents).toBe(contents)
  expect(renderToMarkdown(result.contents).contents).toBe(result.contents)
})

test('compile multiline block to markdown, with multiline paragraph', () => {
  const fixture = dedent`
    [[information]]
    | content
    |
    | > blockquote
    |
    | a long
    | multiline
    | paragraph
  `
  let {contents} = renderToMarkdown(fixture)
  contents = renderToMarkdown(contents).contents
  contents = renderToMarkdown(contents).contents.trim()
  expect(contents).toBe(fixture)
})

test('with customized container, contents and title element types', () => {
  const {contents} = render(fixture, true, {
    attention: {
      title: 'optional',
      titleElement: 'header',
      contentsElement: 'section',
      containerElement: 'article',
      classes: 'warning ico-after',
    },
    information: {
      classes: 'information ico-after',
      contentsElement: 'fieldset',
    },
    secret: {
      title: 'optional',
      containerElement: 'details',
      titleElement: 'summary',
    },
  })
  expect(contents).toMatchSnapshot()
})

test('weirdly named blocks', () => {
  // a block name would usually be something like "info" or "spoiler"
  // here we test that using regex special characters still works as
  // block names since they are correctly escaped
  const blockNames = [
    '[a]',
    '(b|)',
    '[a})',
    '[a-Z]',
    '.*',
    '??}',
    '^$',
    '|||',
    ']',
    '[]]',
  ]
  const config = blockNames.reduce((acc, blockName, idx) => {
    acc[blockName] = {
      classes: `class${idx}`,
    }
    return acc
  }, {})
  const render = (text, allowTitle) => unified()
    .use(reParse)
    .use(remark2rehype)
    .use(plugin, config, allowTitle)
    .use(stringify)
    .processSync(text)

  const makeFixture = (blockName) => dedent`
    [[${blockName}]]
    |     [[${blockName}]]
    |     | this
  `

  blockNames.forEach((blockName, idx) => {
    const {contents} = render(makeFixture(blockName))
    expect(contents).toContain(`class="custom-block class${idx}"`)
    expect(contents).toContain(`<pre><code>[[${blockName}]]`)
  })
})
