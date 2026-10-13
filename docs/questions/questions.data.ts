import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import MarkdownIt from 'markdown-it'
import { defineLoader } from 'vitepress'
import { parseTopicFile, type Question } from '../.vitepress/theme/lib/questions'
import { topicById } from '../.vitepress/theme/lib/topics'

declare const data: Question[]
export { data }

const md = new MarkdownIt()
const root = path.dirname(new URL(import.meta.url).pathname)

export default defineLoader({
  watch: ['./**/*.yaml'],
  load(files: string[]): Question[] {
    return files.flatMap((file) => {
      const topic = path.relative(root, file).replace(/\\/g, '/').replace(/\.yaml$/, '')
      if (!topicById(topic)) throw new Error(`[${topic}] тема не описана в lib/topics.ts`)
      return parseTopicFile(yaml.load(fs.readFileSync(file, 'utf8')), topic, (s) => md.render(s))
    })
  },
})
