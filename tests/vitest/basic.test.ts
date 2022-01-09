import { assert, expect, it, suite, test, describe } from 'vitest'
import { move } from '../../editor/src/utilities'
import { convertFieldsToData, makeValidUrl } from '../../editor/src/utils'
import { Field } from '../../editor/src/const'

describe('Utility functions', () => {
  test('move', async() => {
    const initial = [ 'first', 'second', 'third', 'fourth' ]
    const updated = move(initial, 2, 0)
    expect(updated).toStrictEqual(['third', 'first', 'second', 'fourth'])
  })

  test('convertFieldsToData', async () => {
    const data = convertFieldsToData([
      Field({ key: 'heading', value: 'This is a heading' }),
      Field({ type: 'content', key: 'description', value: '<h2>subheading</h2>' }),
      Field({ type: 'link', key: 'button', value: { label: 'Go home', url: '/' } }),
      Field({ 
        type: 'repeater', 
        key: 'items', 
        value: [
          {
            link: {
              label: "Copyright",
              url: "/",
              active: false
            },
            icon: 'home'
          },
          {
            link: {
              label: "Terms",
              url: "/",
              active: false
            },
            icon: 'plus'
          }
        ], 
        fields: [
          {
            id: "wlgig",
            key: "link",
            label: "Link",
            value: "",
            type: "link"
          },
          {
            id: "wlgig",
            key: "icon",
            label: "Icon",
            value: "",
            type: "text"
          }
        ] 
      }),
    ])
    expect(data).toStrictEqual({
      heading: 'This is a heading',
      description: '<h2>subheading</h2>',
      button: { label: 'Go home', url: '/' },
      items: [
        { link: { label: 'Copyright', url: '/', active: false }, icon: 'home' },
        { link: { label: 'Terms', url: '/', active: false }, icon: 'plus' }
      ]
    })
  })

  test('makeValidUrl', async() => {

  })
})