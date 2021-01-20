<script>
	import axios from 'axios/dist/axios'
	import _ from 'lodash'
	import Primo, {modal, createSite, fieldTypes,registerProcessors} from '../../index'
	import PrimoFields from '../../src/field-types'
	import Build from './extensions/Build.svelte'
	import {html,css} from './extensions/processors'

  import { domainInfo } from './stores'

	registerProcessors({
		html: async (raw, fields) => await html(raw, fields),
		css: async (raw, options) => await css(raw, options)
	})

	let data = JSON.parse(window.localStorage.getItem('site')) || createSite()

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
	on:save={({detail:data}) => saveData(data)} 
/>