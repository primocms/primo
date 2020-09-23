<script>
	import axios from 'axios/dist/axios'
	import _ from 'lodash'
	import Primo, {modal, pageId, utils, createSite, fieldTypes} from '../../index'
	import PrimoFields from '@primo-app/field-types'
	import Build from './extensions/Build.svelte'

  import { domainInfo } from './stores'

	export let subdomain

	$: domainInfo.save({ 
		subdomain,
		page: $pageId
	})

	async function processPostCSS(args) {
		const {data:styles} = await axios.post('http://localhost:3000/postcss', args)
		return styles
	}

	let sites = JSON.parse(window.localStorage.getItem('sites')) || [createSite()]
	let data = sites[0]

	function saveData(sites) {
		const json = JSON.stringify(sites)
		window.localStorage.setItem('sites', json)
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
	{sites}
	{role}
	functions={{
		processPostCSS
	}}
	on:save={({detail:data}) => saveData(data)} 
	on:change={({detail:content}) => {
		console.log(content)
	}} 
/>