import Number from './Number.svelte'
import ImageField from './ImageField.svelte'
import Markdown from './Markdown.svelte'
import Switch from './Switch.svelte'
import URL from './URL.svelte'
import Link from './Link.svelte'
import Information from './Information.svelte'
import Select from './SelectField.svelte'
import RepeaterField from './RepeaterField.svelte'
import GroupField from './GroupField.svelte'
import TextField from './TextField.svelte'
import IconField from './IconField.svelte'
// import Date from './Date.svelte'
import Slider from './Slider.svelte'
// import Data from './Data.svelte'
import PageFieldField from './PageFieldField.svelte'
import SiteField from './SiteField.svelte'
import PageField from './PageField.svelte'
import PageList from './PageList.svelte'

export const dynamic_field_types = ['page-field', 'site-field', 'page', 'page-list']

export default [
	{
		id: 'repeater',
		icon: 'formkit:repeater',
		label: 'Repeater',
		component: RepeaterField
	},
	{
		id: 'group',
		icon: 'formkit:group',
		label: 'Group',
		component: GroupField
	},
	{
		id: 'text',
		icon: 'formkit:text',
		label: 'Text',
		component: TextField
	},
	{
		id: 'markdown',
		icon: 'material-symbols:markdown',
		label: 'Markdown',
		component: Markdown
	},
	{
		id: 'link',
		icon: 'formkit:link',
		label: 'Link',
		component: Link
	},
	{
		id: 'image',
		icon: 'carbon:image',
		label: 'Image',
		component: ImageField
	},
	{
		id: 'icon',
		icon: 'fa6-solid:icons',
		label: 'Icon',
		component: IconField
	},

	{
		id: 'number',
		icon: 'formkit:number',
		label: 'Number',
		component: Number
	},
	{
		id: 'url',
		icon: 'formkit:url',
		label: 'URL',
		component: URL
	},
	// {
	// 	id: 'date',
	// 	label: 'Date',
	// 	component: Date
	// },
	// {
	// 	id: 'data',
	// 	icon: 'majesticons:data',
	// 	label: 'Site Data',
	// 	component: Data
	// },
	{
		id: 'page-field',
		icon: 'iconoir:page',
		label: 'Page Content',
		component: PageFieldField
	},
	{
		id: 'site-field',
		icon: 'gg:website',
		label: 'Site Content',
		component: SiteField
	},
	{
		id: 'page',
		icon: 'iconoir:page',
		label: 'Page',
		component: PageField
	},
	{
		id: 'page-list',
		icon: 'iconoir:multiple-pages',
		label: 'Page List',
		component: PageList
	},
	{
		id: 'slider',
		icon: 'radix-icons:slider',
		label: 'Slider',
		component: Slider
	},
	{
		id: 'switch',
		icon: 'ion:toggle',
		label: 'Toggle',
		component: Switch
	},
	{
		id: 'select',
		icon: 'fluent-mdl2:dropdown',
		label: 'Select',
		component: Select
	},
	{
		id: 'info',
		icon: 'formkit:info',
		label: 'Info',
		component: Information
	},
	// {
	// 	id: 'user-form',
	// 	icon: 'fluent:form-multiple-20-filled',
	// 	label: 'Visitor Form',
	// 	component: UserFormSelect
	// }
	// {
	//   id: 'color',
	//   label: 'Color Picker',
	//   component: ColorPicker
	// }
]
