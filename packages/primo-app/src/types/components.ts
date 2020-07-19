// COMPONENT EDITOR

export type Subfield = {
  id: string
  key: string
  label: string
  value: string
  type: string
}

export type Field = {
  id: string
  key: string
  label: string
  value: Array<any> | string
  type: string
  fields: Array<Subfield>
  endpoint?: string
  endpointPath?: string
  code?: string
}
export type Fields = Array<Field>

export type Component = {
  type: 'component'
  id: string
  symbolID: null | string
  value: {
    raw: {
      html: string
      css: string
      js: string
      fields: Fields
    }
    final: {
      html: string
      css: string
      js: string
    }
  }
  title?: string
  height?: number
}

export type Property = 'html' | 'css' | 'js' | 'fields'

export type FieldType = {
  id: string
  label: string
}

// TABS

export type Tab = {
  label: string
  icon: string
}

export type Tabs = Array<Tab>
