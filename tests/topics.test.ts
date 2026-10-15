import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { BLOCKS, EXTRA_PAGES, TOPICS } from '../docs/.vitepress/theme/lib/topics'

const docs = path.resolve(__dirname, '../docs')

describe('реестр уроков', () => {
  it.each(TOPICS.map((t) => [t.id, t.link]))('%s: файл урока существует (%s)', (_id, link) => {
    expect(fs.existsSync(path.join(docs, `${link}.md`))).toBe(true)
  })
  it.each(BLOCKS.map((b) => b.id))('блок %s имеет index.md', (id) => {
    expect(fs.existsSync(path.join(docs, id, 'index.md'))).toBe(true)
  })
  it('у каждой темы известный блок и числовой num', () => {
    for (const t of TOPICS) {
      expect(BLOCKS.some((b) => b.id === t.block)).toBe(true)
      expect(typeof t.num).toBe('number')
    }
  })
  it.each(EXTRA_PAGES.map((p) => [p.link, p.block]))('доп. страница %s существует и её блок известен', (link, block) => {
    expect(fs.existsSync(path.join(docs, `${link}.md`))).toBe(true)
    expect(BLOCKS.some((b) => b.id === block)).toBe(true)
  })
})
