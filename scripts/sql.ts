/* eslint-disable no-nested-ternary */
import fs from 'fs';
import { parse, getRealType, Declaration } from './pet';
import { parseArgs } from '../src/args';

export const args = parseArgs({
  out: {
    alias: 'o',
    description: '指定输出文件',
    required: true,
  },
});

const tables: Record<string, Declaration> = {};

parse({
  plugins: {
    eachDeclaration(scoped, name, d) {
      if (d.decorations?.table) {
        tables[d.decorations.table as any] = d;
      }
    },
  },
});

function gen(): string {
  return Object.entries(tables).map(([name, table]) => {
    let all = [...Object.entries(table.members || {})];
    for (const iterator of (table.inherited || [])) {
      if (iterator.link?.members) {
        all = all.concat(Object.entries(iterator.link.members));
      }
    }
    const foreigns: Record<string, string> = {};
    const members = all.map(([mname, member]) => {
      const tail = member.default ? `DEFAULT ${member.default}` : (member.optional ? '' : 'NOT NULL');
      // eslint-disable-next-line prefer-const
      let ref = getRealType(member);
      let { typeName } = ref;
      const nameUp = typeName.toUpperCase();
      if (member.decorations?.field) {
        typeName = member.decorations.field as string;
      } else if (nameUp === 'UINT') {
        typeName = 'INT UNSIGNED';
      } else if (nameUp === 'ENUM') {
        typeName = 'INT';
      } else if (typeName === 'varchar' && ref.params?.length) {
        typeName += `(${ref.params[0].literal})`;
      }
      if (member.decorations?.foreign) {
        foreigns[mname] = member.decorations.foreign as any;
      }
      return `\`${mname}\` ${typeName.toUpperCase()} ${tail} COMMENT '${member.comments?.join()}'`;
    })
      .join(',\n ');

    const blocks: Array<string> = [members];
    let index: Array<string> = table.decorations?.index as any;
    if (index && !Array.isArray(index)) {
      index = [index];
    }
    if (index?.length) {
      blocks.push(`  INDEX \`${name}_ix\` (${index.map(e => `\`${e}\``).join(',')})`);
    }
    let unique: Array<string> = table.decorations?.unique as any;
    if (unique && !Array.isArray(unique)) {
      unique = [unique];
    }
    if (unique?.length) {
      blocks.push(`  UNIQUE (${unique.map(e => `\`${e}\``).join(',')})`);
    }
    let keys: Array<string> = table.decorations?.key as any;
    if (keys && !Array.isArray(keys)) {
      keys = [keys];
    }
    if (keys?.length) {
      blocks.push(`  PRIMARY KEY (${keys.map(e => `\`${e}\``).join(',')})`);
    }
    if (Object.keys(foreigns).length) {
      const lines: Array<string> = [];
      for (const [k, v] of Object.entries(foreigns)) {
        lines.push(`  FOREIGN KEY (${k}) REFERENCES ${v} ON DELETE CASCADE ON UPDATE CASCADE`);
      }
      if (lines.length) {
        blocks.push(lines.join(',\n'));
      }
    }
    return `CREATE TABLE IF NOT EXISTS \`${name}\` (\n ${blocks.join(',\n')}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
  })
    .join('\n\n');
}

const src = gen();

fs.writeFileSync(args.out, src, 'utf-8');
console.log(`已输出到文件 ${args.out}`);
