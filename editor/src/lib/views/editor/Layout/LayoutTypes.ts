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

export type Options = {
  id: string
  type: 'options'
}

export type Block = Content | Component | Options

export type Button = {
  title: string
  icon: string
  key?: string
  id?: string
  buttons?: Array<Button>
}

export type ButtonGroup = Array<Button>
