/* eslint-disable no-nested-ternary */
import fs from 'fs';
import path from 'path';
import { parse, getRealType, getDirectDeclWithComment, parseRelativeDecls, calcDeclMembers, AsTree, Declaration } from './pet';

const modules: Record<string, { scoped: AsTree, decl: Declaration }> = {};
const tables: Record<string, Declaration> = {};

parse({
  plugins: {
    eachDeclaration(scoped, name, decl) {
      if (name === 'Module') {
        modules[scoped.name] = { scoped, decl };
      } else if (decl.decorations?.table) {
        tables[decl.decorations.table as any] = decl;
      }
    },
  },
});

function gen(): { types: string; db: string; apis: string } {
  const types: Record<string, Declaration> = {};
  const mods = Object.entries(modules).map(([, it]) => {
    const all = [...Object.entries(it.decl.methods || {})].sort((a, b) => a[0].localeCompare(b[0]));
    const items = all.map(([name, method]) => {
      const inputs = method.inputs.map((e) => {
        if (e.typeName === 'DispContext') {
          return undefined;
        }
        parseRelativeDecls(e, types);
        let comments = null as any;
        if (method.decorations?.param) {
          comments = (method.decorations.param as any)[e.name];
          if (comments && !Array.isArray(comments)) {
            comments = [comments];
          }
        }
        if (!comments && e.link) {
          const declWithComment = getDirectDeclWithComment(e.link);
          if (declWithComment) {
            comments = declWithComment.comments;
          }
        }
        const dispType = e.type ? (e.type as any).getText().replace(/\|/g, '\\|') : e.typeName;
        return `| ${e.optional ? '?' : '*'} | ${e.name} | [\`${dispType}\`](##${e.typeName}) | ${(comments || []).join('<br>')} |`;
      }).filter(e => e);
      inputs.splice(0, 0, '| --- | --- | --- | --- |');
      inputs.splice(0, 0, '| 必填项 | 名称 | 类型 | 描述 |');
      const output = [method.output].map((e) => {
        let { typeName } = e;
        if (typeName === 'void') {
          return undefined;
        }
        let dispName = typeName;
        if (e.type) {
          dispName = (e.type as any).getText();
        }
        if (e.params?.length) {
          if (typeName === 'Array') {
            typeName = e.params[0].typeName;
          } else if (['Promise', 'Omit'].indexOf(typeName) !== -1) {
            typeName = e.params[0].typeName;
            dispName = (e.params[0].type as any).getText();
          }
        }
        parseRelativeDecls(e, types);
        return `[\`${dispName}\`](##${typeName})`;
      }).filter(e => e)
        .join(' | ') || '无';
      return `### \`${name}\`\n\n说明：\n${(method.comments || []).join('<br>')}\n\n参数：\n\n${inputs.join('\n')}\n\n输出：${output}, ${method.decorations?.return || ''}`;
    });

    items.splice(0, 0, `## \`【${it.decl.decorations?.label || ''}】\``);

    return items.join('\n\n');
  });

  const tys = Object.entries(types).sort((a, b) => a[0].localeCompare(b[0]))
    .map(([tname, it]) => {
      const ms = calcDeclMembers(it);
      const vs = Object.entries(ms || {} as any);
      vs.sort((a, b) => a[0].localeCompare(b[0]));
      if (!vs.length) {
        return `## \`${tname}\`\n\n说明：\n${(it.comments || []).join('<br>')}\n\n类型：${it.type.type ? (it as any).type.type.getText() : it.type.typeName}`;
      }
      const members = vs.map(([name, member]) => {
        let comments = null as any;
        const declWithComment = getDirectDeclWithComment(member as any);
        if (declWithComment) {
          comments = declWithComment.comments;
        }
        const { typeName } = member;
        const dispName = member.type ? (member.type as any).getText().replace(/\|/g, '\\|') : typeName;
        if (it.type.typeName === 'enum') {
          return `| ${name} | [\`${dispName}\`](##${typeName}) | ${(comments || []).join('<br>')} |`;
        }
        return `| ${(member as any).optional ? '?' : '*'} | ${name} | [\`${dispName}\`](##${typeName}) | ${(comments || []).join('<br>')} |`;
      });
      if (it.type.typeName === 'enum') {
        members.splice(0, 0, '| --- | --- | --- |');
        members.splice(0, 0, '| 名称 | 类型 | 描述 |');
        return `## \`${tname}\`\n\n说明：\n${(it.comments || []).join('<br>')}\n\n枚举值列表：\n\n${members.join('\n')}`;
      }
      members.splice(0, 0, '| --- | --- | --- | --- |');
      members.splice(0, 0, '| 必填项 | 名称 | 类型 | 描述 |');
      return `## \`${tname}\`\n\n说明：\n${(it.comments || []).join('<br>')}\n\n成员：\n\n${members.join('\n')}`;
    })
    .filter(e => e);

  const tbs = Object.entries(tables).sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, table]) => {
      let all = [...Object.entries(table.members || {})];
      for (const iterator of (table.inherited || [])) {
        if (iterator.link?.members) {
          all = all.concat(Object.entries(iterator.link.members));
        }
      }
      let index: Array<string> = table.decorations?.index as any;
      if (index && !Array.isArray(index)) {
        index = [index];
      }
      if (!index) index = [];
      let keys: Array<string> = table.decorations?.key as any;
      if (keys && !Array.isArray(keys)) {
        keys = [keys];
      }
      if (!keys) keys = [];
      const members = all.map(([mname, member]) => {
        // eslint-disable-next-line prefer-const
        let ref = getRealType(member);
        let { typeName } = ref;
        if (member.decorations?.field) {
          typeName = member.decorations.field as string;
        } else if (typeName === 'varchar' && ref.params?.length) {
          typeName += `(${ref.params[0].literal})`;
        }
        let comments = null as any;
        const declWithComment = getDirectDeclWithComment(member as any);
        if (declWithComment) {
          comments = declWithComment.comments;
        }
        const koi = keys.includes(mname) ? 'KEY' : (index.includes(mname) ? 'INDEX' : '');
        return `| ${mname} | ${koi} | ${typeName} | ${(comments || []).join('<br>')} |`;
      });

      members.splice(0, 0, '| --- | --- | --- | --- |');
      members.splice(0, 0, '| 名称 | 关键字OR索引 | 类型描述 | 说明 |');
      return `## \`${name}\`\n\n说明：\n${(table.comments || []).join('<br>')}\n\n字段：\n\n${members.join('\n')}`;
    });

  return { db: tbs.join('\n\n'), apis: mods.join('\n\n'), types: tys.join('\n\n') };
}

const rs = gen() as any;

for (const iterator of ['apis', 'db', 'types']) {
  const outFile = path.resolve(__dirname, `../docs/${iterator}.md`);
  fs.writeFileSync(outFile, rs[iterator], 'utf-8');
  console.log(`已输出到文件 ${outFile}`);
}
