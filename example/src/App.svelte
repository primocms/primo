<script>
	import axios from 'axios/dist/axios'
	import _ from 'lodash'
	import Primo, {modal, pageId, utils, createSite, fieldTypes} from '../../index'
	import PrimoFields from '@primo-app/field-types'
	import Build from './extensions/Build.svelte'

  import { domainInfo } from './stores'
	
	async function processPostCSS(args) {
		const {data:styles} = await axios.post('http://localhost:3000/postcss', args)
		return styles
	}

	let data = window.localStorage.getItem('site') || createSite()

	function saveData(site) {
		const json = JSON.stringify(site)
		window.localStorage.setItem('site', json)
	}

	// Create Modals
	modal.register([
		{
			id: 'BUILD',
			component: Build,
			options: {
				width: 'md',
				header: {
					title: 'Build Site',
					icon: 'fas fa-hammer'
				},
			},
		}
	])

	// Register Field Types
	fieldTypes.register(PrimoFields)

	let role = 'developer'

</script>


<Primo 
	{data}
	{role}
	functions={{
		processPostCSS
	}}
	on:save={({detail:data}) => saveData(data)} 
	on:change={({detail:content}) => {
		console.log(content)
	}} 
/>