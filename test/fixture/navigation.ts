export class Outer {
  constructor(readonly label: string) {}

  process(input: string): string {
    return input.trim()
  }

  nested() {
    return class Nested {
      run() {
        return 'nested'
      }
    }
  }
}

export class Other {
  process(input: string): string {
    return input.toUpperCase()
  }
}

export function caller(): string {
  return new Outer('fixture').process(' value ')
}
