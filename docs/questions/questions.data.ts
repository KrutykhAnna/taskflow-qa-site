import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import MarkdownIt from 'markdown-it'
import { defineLoader } from 'vitepress'
import { fileURLToPath } from 'node:url'
import { assertUniqueIds, parseTopicFile, type Question } from '../.vitepress/theme/lib/questions'
import { topicById } from '../.vitepress/theme/lib/topics'

declare const data: Question[]
export { data }

const md = new MarkdownIt()
const root = fileURLToPath(new URL('.', import.meta.url))

export default defineLoader({
  watch: ['./**/*.yaml', './**/*.yml'],
  load(files: string[]): Question[] {
    const all = files.flatMap((file) => {
      if (file.endsWith('.yml')) throw new Error(`${file}: используй расширение .yaml`)
      const topic = path.relative(root, file).replace(/\\/g, '/').replace(/\.yaml$/, '')
      if (!topicById(topic)) throw new Error(`[${topic}] тема не описана в lib/topics.ts`)
      return parseTopicFile(yaml.load(fs.readFileSync(file, 'utf8'), { filename: file }), topic, (s) => md.render(s))
    })
    assertUniqueIds(all)
    return all
  },
})
