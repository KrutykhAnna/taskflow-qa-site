import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import MarkdownIt from 'markdown-it'
import { defineLoader } from 'vitepress'
import { assertUniqueSqlIds, parseSqlTaskFile, SQL_TOPICS, type SqlTask } from '../.vitepress/theme/lib/sql/tasks'

declare const data: SqlTask[]
export { data }

const md = new MarkdownIt()
const order = (topic: string) => SQL_TOPICS.findIndex((t) => t.id === topic)

export default defineLoader({
  watch: ['./*.yaml', './*.yml'],
  load(files: string[]): SqlTask[] {
    const all = files.flatMap((file) => {
      if (file.endsWith('.yml')) throw new Error(`${file}: используй расширение .yaml`)
      const topic = path.basename(file, '.yaml')
      return parseSqlTaskFile(yaml.load(fs.readFileSync(file, 'utf8'), { filename: file }), topic, (s) => md.render(s))
    })
    assertUniqueSqlIds(all)
    return all.sort((a, b) => order(a.topic) - order(b.topic) || a.num - b.num)
  },
})
