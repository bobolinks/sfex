/* eslint-disable @typescript-eslint/no-namespace */
import ts, { NodeArray } from 'typescript';
import minimist from 'minimist';
import globby from 'globby';

// ts 4.4.3

export type Type = 'boolean' | 'tinyint' | 'int' | 'uint' | 'bigint' | 'float' | 'double' | 'datetime' | 'date' | 'time' | 'timestamp' | 'char' | 'varchar' | 'text' | 'blob' | 'enum' | 'json';
export type Json = Record<string, any>;

/** has comment */
export interface WithComent {
  decorations?: Record<string, string | Array<string> | Json>;
  comments?: Array<string>;
}

/** reference */
export interface TypeRef {
  type: ts.Type;
  typeName: string;
  literal?: string | boolean | number;
  params?: Array<TypeRef>;
  link?: Declaration;
  resolved?: TypeRef;
}

interface Arg extends TypeRef {
  name: string;
  optional?: boolean;
}

/** method */
interface Method extends WithComent {
  /** arg list */
  inputs: Array<Arg>;
  /** output or */
  output: TypeRef;
}
type Methods = Record<string, Method>;

/** declaration */
export interface Declaration extends WithComent {
  kind: ts.SyntaxKind;
  node: ts.Node;
  type: TypeRef;
  size?: number;
  values?: Array<number | string>;
  inherited?: Array<TypeRef>;
  members?: Record<string, Member>;
  methods?: Methods;
}

/** member */
export interface Member extends TypeRef, WithComent {
  optional?: boolean;
  default?: boolean | number | bigint | string;
}

/** syntax tree */
export type AsTree = {
  name: string;
  fileName: string;
  parent?: AsTree;
  declarations: Record<string, Declaration>;
  modules?: Record<string, AsTree>;
  namespaces?: Record<string, AsTree>;
};

export type Options = {
  plugins?: {
    eachFile?(fileName: string): void;
    eachDeclaration?(scoped: AsTree, name: string, decl: Declaration): void;
    eachModule?(scoped: AsTree, name: string, module: AsTree): void;
    eachNamespace?(scoped: AsTree, name: string, namespace: AsTree): void;
  };
};

const constTypes = ['boolean', 'tinyint', 'int', 'uint', 'bigint', 'float', 'double', 'datetime', 'date', 'time', 'timestamp', 'char', 'varchar', 'text', 'blob', 'enum', 'json'];
const sysTypes = ['undefined', 'void', 'Literal', 'Union', 'Array', 'Record', 'Omit', 'Partial', 'Promise', 'Object'];
const allTypesSupported = constTypes.concat(...sysTypes);

function warn(source: ts.SourceFile, node: ts.Node, ...args: any[]) {
  console.warn(...[`${source.fileName.slice(-20)} :\`${node.getText()}\``, ...args]);
}

function parseDecorations(node: any /** ts.Node */, declaration: WithComent) {
  if (!node.jsDoc) {
    return;
  }
  const lines = node.jsDoc.map((e: any) => e.comment?.toString() || '').filter((e: any) => e.trim());
  declaration.comments = lines.map((e: any) => e.split('\n')).flat();
  if (!declaration.decorations) {
    declaration.decorations = {};
  }
  for (const doc of (node.jsDoc || [] as any)) {
    if (!doc.tags) continue;
    for (const tag of doc.tags) {
      let decName = tag.tagName.text;
      if (!decName) {
        continue;
      }
      const subName = (tag.typeExpression?.getText() || tag.name?.escapedText || '').trim();
      const allText = (tag.comment || '').trim();
      if (/^json\s\{/i.test(allText)) {
        // eslint-disable-next-line no-eval
        const json = eval(`(${allText.replace(/^json/i, '')})`);
        if (json) {
          declaration.decorations[decName] = json;
        }
        continue;
      }
      const [, ns1] = /^\s*(.+)\s*$/.exec(allText) || [];
      if (!ns1) {
        declaration.decorations[decName] = '';
        continue;
      }
      let vs = declaration.decorations;
      if (subName) {
        vs = declaration.decorations[decName] as any;
        if (typeof vs !== 'object') {
          vs = {};
          declaration.decorations[decName] = vs;
        }
        decName = subName;
      }
      if (/^\[.*\]$/.test(ns1)) {
        vs[decName] = ns1.substring(1).replace(/.$/, '')
          .split(',')
          .filter(e => e);
      } else {
        vs[decName] = ns1.replace(/^'/, '').replace(/'$/, '');
      }
    }
  }
}

function parseInherited(checker: ts.TypeChecker, source: ts.SourceFile, node: any /** ts.Node */, decl: Declaration) {
  for (const iterator of (node.heritageClauses || [] as any)) {
    for (const it of (iterator.types || [])) {
      const heriName = it.expression.escapedText;
      if (!decl.inherited) {
        decl.inherited = [];
      }
      decl.inherited.push({
        type: it,
        typeName: heriName,
        params: parseParams(checker, source, it),
      });
    }
    break;
  }
}

function parseDefault(mem: Member) {
  if (mem.decorations?.default) {
    if (mem.typeName === 'boolean') {
      mem.default = mem.decorations.default === 'true';
    } else if (['tinyint', 'int', 'bigint', 'float', 'double'].indexOf(mem.type as any) !== -1) {
      mem.default = parseInt(mem.decorations.default as any, 10) || 0;
    } else {
      mem.default = mem.decorations.default as any;
    }
  }
}

function parseParams(checker: ts.TypeChecker, source: ts.SourceFile, type: any /** ts.Type */): Array<TypeRef> {
  return (type.typeArguments || [] as any).map((e: any) => parseType(checker, source, e)).filter((e: any) => e);
}

function parseType(checker: ts.TypeChecker, source: ts.SourceFile, type: any /** ts.Type */): TypeRef {
  const typeName = type.typeName?.escapedText;
  const ref: TypeRef = {
    type,
    typeName,
    params: [],
  };
  for (const iterator of (type.typeArguments || type.types || [])) {
    const paramRef = parseType(checker, source, iterator);
    if (paramRef) {
      ref.params?.push(paramRef);
    }
  }
  if (typeName) {
    const lwTypeName = (typeName as string).toLowerCase() as any;
    if (constTypes.indexOf(lwTypeName) !== -1) {
      ref.typeName = lwTypeName;
    }
  } else if (type.kind === ts.SyntaxKind.StringKeyword) {
    ref.typeName = 'text';
  } else if (type.kind === ts.SyntaxKind.NumberKeyword) {
    ref.typeName = 'double';
  } else if (type.kind === ts.SyntaxKind.BigIntKeyword) {
    ref.typeName = 'bigint';
  } else if (type.kind === ts.SyntaxKind.BooleanKeyword) {
    ref.typeName = 'boolean';
  } else if (type.kind === ts.SyntaxKind.AnyKeyword) {
    ref.typeName = 'json';
  } else if (type.kind === ts.SyntaxKind.UndefinedKeyword) {
    ref.typeName = 'undefined';
  } else if (type.kind === ts.SyntaxKind.VoidKeyword) {
    ref.typeName = 'void';
  } else if (type.kind === ts.SyntaxKind.LiteralType) {
    ref.typeName = 'Literal';
    ref.literal = type.literal.text;
  } else if (ts.isUnionTypeNode(type)) {
    ref.typeName = 'Union';
  } else if (type.kind === ts.SyntaxKind.TypeLiteral) {
    ref.typeName = 'Object';
  } else {
    warn(source, type, 'type unsupported!');
  }
  return ref;
}

function parseMethod(checker: ts.TypeChecker, source: ts.SourceFile, node: any /** ts.MethodDeclaration */, type: any /** ts.Type */): Method {
  const method: Method = {
    decorations: {},
    inputs: [],
    output: null as any,
  };
  for (const iterator of node.parameters) {
    const { type } = iterator;
    const arg = parseType(checker, source, type) as Arg;
    arg.name = iterator.name.escapedText;
    const optional = !!(iterator as any).questionToken;
    if (optional) {
      arg.optional = optional;
    }
    method.inputs.push(arg);
  }
  method.output = parseType(checker, source, type);
  return method;
}

function parseMembersAnMethods(checker: ts.TypeChecker, source: ts.SourceFile, members: NodeArray<ts.Statement>, decl: Declaration) {
  for (const it of (members || [] as any)) {
    const fname = (it as any).name?.escapedText;
    if (!fname) {
      warn(source, it, 'unknown syntax');
      continue;
    }
    const type = checker.getBaseTypeOfLiteralType((it as any).type) as any;
    if (it.kind === ts.SyntaxKind.MethodSignature) {
      if (!decl.methods) decl.methods = {};
      const method = parseMethod(checker, source, it, type);
      decl.methods[fname] = method;
      parseDecorations(it, method);
    } else if (it.kind === ts.SyntaxKind.PropertySignature) {
      if (!decl.members) decl.members = {};
      const member: Member = parseType(checker, source, (it as any).type);
      decl.members[fname] = member;
      parseDecorations(it, member);
      parseDefault(member);
      if ((it as any).questionToken) {
        member.optional = true;
      }
    }
  }
}

function parseEnumMembers(checker: ts.TypeChecker, source: ts.SourceFile, members: NodeArray<ts.Statement>, decl: Declaration) {
  let index = 0;
  for (const it of (members || [] as any)) {
    const fname = (it as any).name?.escapedText;
    if (!fname) {
      warn(source, it, 'unknown syntax');
      continue;
    }
    const value = (it as any).initializer?.getText();
    if (value !== undefined) {
      index = parseInt(value, 10);
    }
    if (!decl.members) decl.members = {};
    const member: Member = {
      type: (it as any).initializer,
      typeName: 'Literal',
      literal: index.toString(),
      params: [],
    };
    parseDecorations(it, member);
    decl.members[fname] = member;
    index++;
  }
}

function reshapeAsTree(checker: ts.TypeChecker, tree: AsTree, options: Partial<Options>): void {
  const findDeclaration = (name: string, scoped: AsTree): Declaration | undefined => {
    let cur = scoped as any;
    while (cur) {
      const d = cur.declarations[name];
      if (d) {
        return d;
      }
      cur = cur.parent;
    }
    return;
  };
  const linkType = (type: TypeRef, scoped: AsTree) => {
    if (!type.link) {
      const decl = findDeclaration(type.typeName, scoped);
      if (decl) {
        type.link = decl;
      } else if (type.typeName && allTypesSupported.indexOf(type.typeName) === -1) {
        console.warn(`${type.typeName} not found!`);
      }
    }
    for (const iterator of type.params || []) {
      if (iterator.link) continue;
      linkType(iterator, scoped);
    }
  };
  const resolveType = (type: TypeRef, scoped: AsTree): TypeRef | undefined => {
    let { typeName } = type;
    let curType = type;
    while (curType) {
      if (constTypes.indexOf(typeName) !== -1) {
        return curType;
      } if (sysTypes.indexOf(typeName) !== -1) {
        break;
      } if (curType.params?.length) {
        break;
      }
      const d = findDeclaration(typeName, scoped);
      if (!d) {
        break;
      }
      curType = d.type;
      typeName = curType?.typeName;
    }
    return undefined;
  };
  const traverse = (node: AsTree) => {
    for (const [name, decl] of Object.entries(node.declarations)) {
      if (decl.type.typeName === 'Object') {
        for (const iterator of Object.values(decl.members || {})) {
          linkType(iterator, node);
          iterator.resolved = resolveType(iterator, node);
        }
        for (const iterator of Object.values(decl.methods || {})) {
          for (const it of iterator.inputs) {
            linkType(it, node);
            it.resolved = resolveType(it, node);
          }
          if (iterator.output) {
            const it = iterator.output;
            linkType(it, node);
            it.resolved = resolveType(it, node);
          }
        }
      } else {
        const ref: TypeRef = decl.type as any;
        linkType(ref, node);
        ref.resolved = resolveType(ref, node);
      }
      for (const ref of Object.values(decl.inherited || {})) {
        linkType(ref, node);
        ref.resolved = resolveType(ref, node);
      }
      if (options.plugins?.eachDeclaration) {
        options.plugins.eachDeclaration(node, name, decl);
      }
    }
    for (const [name, it] of Object.entries(node.modules || {})) {
      traverse(it);
      if (options.plugins?.eachModule) {
        options.plugins.eachModule(node, name, it);
      }
    }
    for (const [name, it] of Object.entries(node.namespaces || {})) {
      traverse(it);
      if (options.plugins?.eachNamespace) {
        options.plugins.eachNamespace(node, name, it);
      }
    }
  };

  traverse(tree);
}

function parseAsTree(checker: ts.TypeChecker, sources: readonly ts.SourceFile[], options: Partial<Options>): AsTree {
  const tree: AsTree = {
    fileName: args._[0],
    name: 'global',
    declarations: {},
  };
  const parser = (node: AsTree, source: ts.SourceFile, statements: NodeArray<ts.Statement>): void => {
    for (const stmt of statements) {
      if (stmt.kind === ts.SyntaxKind.TypeAliasDeclaration) {
        const name = (stmt as any).name.escapedText;
        const decl: Declaration = {
          kind: stmt.kind,
          node: stmt,
          type: {} as any,
        };
        node.declarations[name] = decl;
        parseDecorations(stmt, decl);
        const type = (stmt as any).type as any;
        if (type) {
          decl.type = parseType(checker, source, type);
        }
        const members = (stmt as any).type?.members;
        if (members) {
          parseMembersAnMethods(checker, source, members, decl);
        }
      } else if (stmt.kind === ts.SyntaxKind.InterfaceDeclaration) {
        const name = (stmt as any).name.escapedText;
        const decl: Declaration = {
          kind: stmt.kind,
          node: stmt,
          type: {
            type: (stmt as any).type,
            typeName: 'Object',
          },
        };
        node.declarations[name] = decl;
        parseDecorations(stmt, decl);
        parseInherited(checker, source, stmt, decl);
        const { members } = stmt as ts.InterfaceDeclaration;
        if (members) {
          parseMembersAnMethods(checker, source, members as any, decl);
        }
      } else if (stmt.kind === ts.SyntaxKind.EnumDeclaration) {
        const name = (stmt as any).name.escapedText;
        const decl: Declaration = {
          kind: stmt.kind,
          node: stmt,
          type: {
            type: (stmt as any).type,
            typeName: 'enum',
          },
        };
        node.declarations[name] = decl;
        parseDecorations(stmt, decl);
        const { members } = stmt as ts.InterfaceDeclaration;
        if (members) {
          parseEnumMembers(checker, source, members as any, decl);
        }
      } else if (stmt.kind === ts.SyntaxKind.ModuleDeclaration) {
        const isNamespace = stmt.flags & ts.NodeFlags.Namespace;
        const name = (stmt as any).name.text;
        const sub = {
          name,
          fileName: source.fileName,
          parent: node,
          declarations: {},
        };
        if (isNamespace) {
          if (!node.namespaces) node.namespaces = {};
          node.namespaces[name] = sub;
        } else {
          if (!node.modules) node.modules = {};
          node.modules[name] = sub;
        }
        parser(sub, source, (stmt as any).body.statements);
      }
    }
  };
  for (const source of sources) {
    if (/\/node_modules\//.test(source.fileName)) {
      continue;
    }
    if (options?.plugins?.eachFile) {
      options.plugins.eachFile(source.fileName);
    }
    parser(tree, source, source.statements);
  }
  return tree;
}

export const args = minimist(process.argv.slice(2));

export function parse(options: Partial<Options>) {
  const program = ts.createProgram(globby.sync(args._), { target: ts.ScriptTarget.ES2015 });
  const checker = program.getTypeChecker();
  const sources = program.getSourceFiles();
  const tree = parseAsTree(checker, sources, options);
  reshapeAsTree(checker, tree, options);
  return tree;
}

export function getDecl(scoped: AsTree, name: string): Declaration {
  let d = scoped.declarations[name];
  while (d && typeof d.type === 'object') {
    if (d.comments?.length) {
      return d;
    }
    d = d.type.link as Declaration;
  }
  return d;
}

export function getRealType(type: TypeRef): TypeRef {
  const { typeName } = type;
  if (constTypes.indexOf(typeName) !== -1) {
    return type;
  } if (typeName === 'Array' || typeName === 'Object') {
    return {
      type: type.type,
      typeName: 'json',
    };
  } if (type.typeName === 'Union' && type.params?.length) {
    let typeName = null as any;
    let kind = null as any;
    let maxLength = 0;
    for (const iterator of type.params) {
      if (!(iterator.type as any).literal || (typeName && iterator.typeName !== typeName)) {
        typeName = undefined;
        break;
      }
      if (kind && kind !== (iterator.type as any).literal.kind) {
        typeName = undefined;
        break;
      }
      typeName = iterator.typeName;
      kind = (iterator.type as any).literal.kind;
      if (iterator.literal) {
        if (maxLength < iterator.literal.toString().length) {
          maxLength = iterator.literal.toString().length;
        }
      }
    }
    if (typeName !== 'Literal') {
      return {
        type: null as any,
        typeName: 'text',
      };
    } if (kind === ts.SyntaxKind.StringLiteral) {
      return {
        type: null as any,
        typeName: 'varchar',
        params: [{
          type: null as any,
          typeName: 'Literal',
          literal: (Math.ceil(1 + (maxLength / 16)) * 16).toString(),
        }],
      };
    }
    return {
      type: null as any,
      typeName: 'int',
    };
  } if (type.params?.length) {
    return {
      type: null as any,
      typeName: 'text',
    };
  } if (type.link) {
    if (type.link.members?.length || type.link.inherited?.length) {
      return {
        type: null as any,
        typeName: 'text',
      };
    }
    return getRealType(type.link.type);
  }
  return {
    type: null as any,
    typeName: 'text',
  };
}

export function getDirectDeclWithComment(decl: Declaration): Declaration {
  let d = decl;
  while (d && typeof d.type === 'object') {
    if (d.comments?.length) {
      return d;
    }
    d = d.type.link as Declaration;
  }
  return d || decl;
}

export function parseRelativeDecls(type: TypeRef, out?: Record<string, Declaration>): Record<string, Declaration> {
  if (!out) {
    out = {};
  }
  if (type.typeName !== 'Union' && type.link && !out[type.typeName]) {
    out[type.typeName] = type.link;
  }
  if (type.link) {
    for (const iterator of Object.values(type.link.members || {})) {
      if (out[iterator.typeName]) continue;
      parseRelativeDecls(iterator, out);
    }
    if (type.link.type) {
      parseRelativeDecls(type.link.type, out);
    }
  }
  for (const iterator of type.params || []) {
    if (out[iterator.typeName]) continue;
    parseRelativeDecls(iterator, out);
  }
  return out;
}

export function parseVisibleDecls(type: TypeRef, out?: Record<string, Declaration>): Record<string, Declaration> {
  if (!out) {
    out = {};
  }
  if (type.typeName !== 'Union' && type.link && !out[type.typeName]) {
    if (!out[type.typeName]) {
      out[type.typeName] = type.link;
    }
  }
  for (const iterator of type.params || []) {
    parseVisibleDecls(iterator, out);
  }
  return out;
}

export function calcDeclMembers(decl: Declaration): Record<string, Member> {
  const out: Record<string, Member> = {};

  const calcTypes = (types: Array<TypeRef>) => {
    for (const t of types) {
      if (!t.link) {
        console.warn(`Declaration of '${t.typeName}' not found!`);
        continue;
      }
      if (t.typeName === 'Partial') {
        const keys = Object.keys(out);
        calcTypeMembers(t);
        for (const [key, it] of Object.entries(out)) {
          if (keys.indexOf(key) === -1) {
            out[key] = Object.assign({}, it, { optional: true });
          }
        }
      } else {
        calcTypeMembers(t);
      }
    }
  };

  const calcTypeMembers = (type: TypeRef) => {
    const d = type.link;
    if (d) {
      for (const [k, v] of Object.entries(d.members || {})) {
        out[k] = v;
      }
      if (d.inherited) {
        calcTypes(d.inherited);
      }
      if (d.type) {
        calcTypeMembers(d.type);
      }
    }
    const { typeName } = type;
    // break
    if (constTypes.indexOf(typeName) !== -1) {
      return out;
    } if (typeName === 'Omit') {
      calcTypeMembers((type as any).params[0]);
      const trf = (type as any).params[1] as any;
      const firstTypeName = trf.typeName;
      // is Union
      if (firstTypeName === 'Union') {
        for (const iterator of trf.params) {
          delete out[iterator.literal];
        }
      } else if (firstTypeName === 'Literal') {
        delete out[trf.literal];
      } else {
        console.warn(`\`${(decl as any).type.type.getText()}\` unsupported!`);
      }
    } else if (typeName === 'Partial') {
      const excludes = Object.keys(out);
      calcTypeMembers((type as any).params[0]);
      for (const [key, it] of Object.entries(out)) {
        if (excludes.indexOf(key) === -1) {
          out[key] = Object.assign({}, it, { optional: true });
        }
      }
    } else {
      // break;
    }
  };
  calcTypeMembers({
    type: null as any,
    typeName: 'Object',
    link: decl,
  });

  return out;
}

export function isInterface(node: ts.Node): boolean {
  return ts.isInterfaceDeclaration(node);
}