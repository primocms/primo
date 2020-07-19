export type Section = {
  id: string
  width: string
  columns: Array<Column>
}

export type Column = {
  id: string
  size: string
  rows: Array<Row>
}

export type Component = {
  id: string
  type: 'component'
  value: {
    raw: {
      html: string
      css: string
      js: string
      fields: Array<any>
    }
    final: {
      css: string
      html: string
      js: string
    }
  }
}

export type Content = {
  id: string
  type: 'content'
  value: {
    html: string
  }
}

export type Row = Content | Component

export type Button = {
  title: string
  icon: string
  key?: string
  id?: string
  buttons?: Array<Button>
}

export type ButtonGroup = Array<Button>
