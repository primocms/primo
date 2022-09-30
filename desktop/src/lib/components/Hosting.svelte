<script>
  import axios from '$lib/libraries/axios'
  import { fade, slide } from 'svelte/transition'
  import hosts from '../../stores/hosts'
  import * as actions from '$lib/actions'
  import TextField from '$lib/ui/TextField.svelte'
  import PrimaryButton from '$lib/ui/PrimaryButton.svelte'
  import {find as _find} from 'lodash-es'
  import { id as siteID } from '@primo-app/primo/src/stores/data/draft'
  import {addDeploymentToSite} from '$lib/actions'

  export let buttons = []
  
  let showingHosts = false
  let errorMessage = null
  let loading = false

  let enteredToken

  const getSVG = (name) => _find(availableHosts, ['id', name])?.svg || ''
  
  
  async function connectVercel(token) {
    showingHosts = false
    const { data } = await axios
      .get('https://api.vercel.com/www/user', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .catch((e) => {
        data: null
      })
    if (data) {
      await actions.hosts.connect({
        name: 'vercel',
        token: enteredToken,
      })
      addDeploymentToSite({ siteID, deployment: {} })
    } else {
      window.alert('Could not connect to host')
    }
  }
  
  async function connectNetlify(token) {
    showingHosts = false
    const { data } = await axios
      .get('https://api.netlify.com/api/v1/user', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .catch((e) => {
        data: null
      })
    if (data) {
      await actions.hosts.connect({
        name: 'netlify',
        token: enteredToken
      })
      addDeploymentToSite({ siteID, deployment: {} })
    } else {
      window.alert('Could not connect to host')
    }
  }
  
  async function connectGithub(token) {
    const headers = { 'Authorization': `Bearer ${token}` }
  
    const {data} = await axios.get(`https://api.github.com/user`, { 
      headers: { ...headers, 'Accept': 'application/vnd.github.v3+json' } 
    })
  
    if (data) {
      await actions.hosts.connect({
        name: 'github',
        token
      })
      addDeploymentToSite({ siteID, deployment: {} })
    }
  }
  
  let hostBeingConnected = null
  
  const availableHosts = [
    {
      id: 'vercel',
      svg: `<svg viewBox="0 0 284 65" fill="currentColor"
            ><title>Vercel Logotype</title><path
              d="M141.68 16.25c-11.04 0-19 7.2-19 18s8.96 18 20 18c6.67 0 12.55-2.64 16.19-7.09l-7.65-4.42c-2.02 2.21-5.09 3.5-8.54 3.5-4.79 0-8.86-2.5-10.37-6.5h28.02c.22-1.12.35-2.28.35-3.5 0-10.79-7.96-17.99-19-17.99zm-9.46 14.5c1.25-3.99 4.67-6.5 9.45-6.5 4.79 0 8.21 2.51 9.45 6.5h-18.9zm117.14-14.5c-11.04 0-19 7.2-19 18s8.96 18 20 18c6.67 0 12.55-2.64 16.19-7.09l-7.65-4.42c-2.02 2.21-5.09 3.5-8.54 3.5-4.79 0-8.86-2.5-10.37-6.5h28.02c.22-1.12.35-2.28.35-3.5 0-10.79-7.96-17.99-19-17.99zm-9.45 14.5c1.25-3.99 4.67-6.5 9.45-6.5 4.79 0 8.21 2.51 9.45 6.5h-18.9zm-39.03 3.5c0 6 3.92 10 10 10 4.12 0 7.21-1.87 8.8-4.92l7.68 4.43c-3.18 5.3-9.14 8.49-16.48 8.49-11.05 0-19-7.2-19-18s7.96-18 19-18c7.34 0 13.29 3.19 16.48 8.49l-7.68 4.43c-1.59-3.05-4.68-4.92-8.8-4.92-6.07 0-10 4-10 10zm82.48-29v46h-9v-46h9zM37.59.25l36.95 64H.64l36.95-64zm92.38 5l-27.71 48-27.71-48h10.39l17.32 30 17.32-30h10.39zm58.91 12v9.69c-1-.29-2.06-.49-3.2-.49-5.81 0-10 4-10 10v14.8h-9v-34h9v9.2c0-5.08 5.91-9.2 13.2-9.2z"
            /></svg
          >`,
    },
    {
      id: 'netlify',
      svg: `<svg viewBox="0 0 104 34" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M42.1792 11.817L42.2605 13.2731C43.1887 12.1469 44.4072 11.5838 45.9155 11.5838C48.5293 11.5838 49.8596 13.0863 49.9059 16.0913V24.4175H47.0878V16.2543C47.0878 15.4547 46.9158 14.8631 46.5718 14.4782C46.2278 14.0939 45.6648 13.9018 44.8835 13.9018C43.7464 13.9018 42.8989 14.4185 42.3432 15.4507V24.4175H39.5238V11.817H42.1805H42.1792ZM58.3061 24.6506C56.5199 24.6506 55.0712 24.0862 53.9618 22.9567C52.8517 21.8271 52.2967 20.3226 52.2967 18.4438V18.0947C52.2967 16.8373 52.5382 15.713 53.0217 14.7233C53.5047 13.7335 54.1841 12.9631 55.058 12.4112C55.9318 11.8607 56.9063 11.5851 57.9819 11.5851C59.6907 11.5851 61.0118 12.1323 61.9432 13.2267C62.876 14.3218 63.3417 15.8701 63.3417 17.8734V19.0149H55.1387C55.2247 20.055 55.57 20.8778 56.1773 21.4833C56.7846 22.0888 57.5486 22.3916 58.4688 22.3916C59.7601 22.3916 60.812 21.8682 61.6244 20.8195L63.1439 22.2756C62.6411 23.0282 61.9703 23.6125 61.1315 24.0279C60.292 24.4433 59.3507 24.6506 58.3068 24.6506H58.3061ZM57.97 13.8561C57.196 13.8561 56.5722 14.1277 56.0966 14.671C55.6203 15.2142 55.3173 15.9714 55.1856 16.942H60.5573V16.7319C60.4951 15.7846 60.2437 15.0691 59.8031 14.5835C59.3619 14.0986 58.7513 13.8561 57.97 13.8561ZM69.0607 8.75495V11.8176H71.2768V13.9137H69.0607V20.9473C69.0607 21.4283 69.1559 21.7755 69.3451 21.9894C69.5343 22.2028 69.873 22.3094 70.3606 22.3094C70.6925 22.3085 71.0233 22.2694 71.3463 22.1928V24.3823C70.7046 24.5612 70.0861 24.65 69.49 24.65C67.3248 24.65 66.2419 23.4509 66.2419 21.052V13.9131H64.1752V11.817H66.2406V8.75428H69.0594L69.0607 8.75495ZM76.4282 24.4181H73.6087V6.53098H76.4282V24.4181ZM82.4958 24.4181H79.6763V11.8176H82.4958V24.4181ZM79.5024 8.54494C79.5024 8.11101 79.6393 7.74995 79.9138 7.46243C80.189 7.17558 80.5813 7.03182 81.0914 7.03182C81.6021 7.03182 81.9963 7.17558 82.2755 7.46243C82.5534 7.74995 82.6923 8.11101 82.6923 8.5456C82.6923 8.97224 82.5534 9.32733 82.2755 9.61088C81.9963 9.89442 81.6021 10.0362 81.0914 10.0362C80.5813 10.0362 80.189 9.89442 79.9138 9.61088C79.6393 9.328 79.5024 8.97224 79.5024 8.5456V8.54494ZM86.5563 24.4181V13.9131H84.6418V11.817H86.5563V10.6642C86.5563 9.26639 86.9426 8.18786 87.716 7.42666C88.49 6.66613 89.5722 6.28586 90.9641 6.28586C91.4596 6.28586 91.9855 6.35542 92.5425 6.4952L92.4731 8.70791C92.1173 8.64178 91.756 8.61072 91.3942 8.61516C90.0479 8.61516 89.3751 9.30945 89.3751 10.6993V11.817H91.9273V13.9131H89.3751V24.4175H86.5563L86.5563 24.4181ZM98.3779 20.3657L100.93 11.8176H103.935L98.9469 26.3281C98.1808 28.4474 96.8816 29.5073 95.0484 29.5073C94.6383 29.5073 94.1858 29.4371 93.691 29.2973V27.1078L94.2248 27.1429C94.936 27.1429 95.4718 27.0131 95.8317 26.7527C96.1909 26.493 96.4754 26.0564 96.6844 25.443L97.0899 24.3598L92.6815 11.8176H95.7212L98.3779 20.3657Z" fill="currentColor"/>
        <path d="M24.0549 11.5475L24.0428 11.5424C24.0359 11.5397 24.029 11.5373 24.0229 11.5311C24.0028 11.5094 23.9938 11.4796 23.9986 11.4504L24.6685 7.34896L27.8099 10.4957L24.5429 11.8878C24.5339 11.8914 24.5241 11.8933 24.5143 11.8929H24.5013C24.497 11.8902 24.4926 11.8868 24.484 11.8781C24.3624 11.7426 24.217 11.6305 24.055 11.5475L24.0549 11.5475ZM28.6115 11.2976L31.9704 14.6613C32.668 15.3608 33.0172 15.7097 33.1446 16.1141C33.1637 16.174 33.1793 16.2339 33.1914 16.2955L25.1642 12.891C25.1599 12.8891 25.1555 12.8874 25.1512 12.8858C25.1191 12.8728 25.0818 12.858 25.0818 12.8251C25.0818 12.7921 25.12 12.7765 25.152 12.7635L25.1624 12.7592L28.6115 11.2976ZM33.0545 17.3751C32.8812 17.7014 32.5432 18.0398 31.9713 18.6135L28.1842 22.4051L23.2863 21.3836L23.2603 21.3785C23.2169 21.3715 23.171 21.3637 23.171 21.3247C23.1334 20.9157 22.9278 20.5407 22.6034 20.2894C22.5835 20.2694 22.5886 20.2382 22.5948 20.2095C22.5948 20.2053 22.5948 20.2009 22.5965 20.1973L23.5177 14.5338L23.5211 14.5147C23.5262 14.4713 23.5341 14.421 23.5731 14.421C23.9719 14.3713 24.334 14.1634 24.5783 13.8439C24.5861 13.8352 24.5913 13.8256 24.6017 13.8204C24.6295 13.8074 24.6624 13.8204 24.691 13.8326L33.0536 17.3751L33.0545 17.3751ZM27.3133 23.2773L21.086 29.5136L22.1519 22.9527L22.1536 22.9441C22.1545 22.9354 22.1563 22.9267 22.1588 22.9189C22.1674 22.8981 22.19 22.8894 22.2116 22.8807L22.222 22.8764C22.4554 22.7767 22.6619 22.6229 22.8243 22.4278C22.8451 22.4035 22.8703 22.38 22.9023 22.3757C22.9107 22.3743 22.9191 22.3743 22.9274 22.3757L27.3124 23.2782L27.3133 23.2773ZM19.7679 30.8335L19.0659 31.5365L11.3056 20.3049C11.3028 20.3008 11.2999 20.2968 11.297 20.2927C11.2849 20.2762 11.2718 20.2597 11.2744 20.2406C11.2744 20.2267 11.284 20.2146 11.2935 20.2042L11.3021 20.1929C11.3255 20.1582 11.3455 20.1235 11.3671 20.0861L11.3844 20.0558L11.3872 20.053C11.3994 20.0322 11.4106 20.0122 11.4313 20.001C11.4495 19.9923 11.4747 19.9958 11.4946 20.0001L20.0921 21.7757C20.1161 21.7794 20.1388 21.7893 20.158 21.8043C20.1692 21.8157 20.1718 21.8278 20.1744 21.8417C20.296 22.3023 20.6256 22.6795 21.0653 22.8614C21.0895 22.8736 21.0792 22.9004 21.068 22.9291C21.0624 22.9417 21.058 22.9547 21.055 22.9681C20.9467 23.6277 20.0177 29.3016 19.7681 30.8334L19.7679 30.8335ZM18.3016 32.3011C17.7842 32.814 17.4792 33.0856 17.1343 33.1949C16.7942 33.3026 16.4293 33.3026 16.0892 33.1949C15.6854 33.0665 15.3361 32.7176 14.6385 32.0181L6.84523 24.2137L8.88086 21.0521C8.89046 21.0365 8.89992 21.0226 8.91552 21.0113C8.93717 20.9957 8.96838 21.0027 8.99438 21.0113C9.46161 21.1525 9.96327 21.127 10.4139 20.9393C10.4373 20.9307 10.4607 20.9245 10.4789 20.941C10.4881 20.9493 10.4961 20.9587 10.5031 20.9688L18.3016 32.3019L18.3016 32.3011ZM6.09389 23.4612L4.30611 21.6709L7.83661 20.1626C7.84563 20.1586 7.85536 20.1566 7.86521 20.1565C7.89467 20.1565 7.91201 20.186 7.92761 20.2129C7.9631 20.2675 8.00067 20.3208 8.04027 20.3726L8.05157 20.3864C8.06198 20.4012 8.05496 20.416 8.04459 20.4298L6.09475 23.4612L6.09389 23.4612ZM3.51491 20.8786L1.25309 18.6135C0.868327 18.2282 0.589284 17.9487 0.395167 17.7083L7.27246 19.1368C7.28109 19.1384 7.28976 19.1399 7.29846 19.1411C7.34092 19.148 7.38771 19.1558 7.38771 19.1957C7.38771 19.2391 7.33658 19.2591 7.29324 19.2756L7.27331 19.2842L3.51491 20.8786ZM0 16.5437C0.00787449 16.3978 0.0340456 16.2534 0.0779876 16.1141C0.206244 15.7097 0.554615 15.3608 1.25309 14.6613L4.14751 11.7628C5.48019 13.6997 6.81648 15.6341 8.15638 17.566C8.17978 17.5972 8.20577 17.632 8.17892 17.658C8.05239 17.7977 7.92587 17.9505 7.83661 18.1162C7.82691 18.1375 7.81202 18.156 7.79327 18.17C7.78197 18.177 7.76987 18.1743 7.75688 18.1718H7.75513L0 16.5428V16.5437ZM4.92225 10.9869L8.8124 7.08944C9.17897 7.24999 10.5109 7.81322 11.7008 8.31657C12.602 8.69842 13.4235 9.04555 13.6818 9.15837C13.7078 9.16879 13.7312 9.17919 13.7424 9.20523C13.7494 9.22086 13.7458 9.24081 13.7424 9.25731C13.6173 9.8288 13.7876 10.425 14.1957 10.8437C14.2217 10.8698 14.1957 10.9071 14.1731 10.9392L14.1611 10.9574L10.2094 17.087C10.199 17.1043 10.1895 17.1191 10.1721 17.1304C10.1513 17.1434 10.1219 17.1374 10.0976 17.1312C9.94391 17.0909 9.78591 17.0693 9.62704 17.067C9.48492 17.067 9.33067 17.0931 9.17468 17.1217H9.17382C9.15649 17.1244 9.14089 17.1278 9.12702 17.1174C9.1117 17.1048 9.09854 17.09 9.08802 17.0732L4.92143 10.987L4.92225 10.9869ZM9.60013 6.30231L14.6385 1.25669C15.3361 0.558079 15.6854 0.20834 16.0892 0.0807664C16.4293 -0.0269221 16.7942 -0.0269221 17.1343 0.0807664C17.5381 0.20834 17.8874 0.558079 18.585 1.25669L19.6769 2.35017L16.0935 7.90782C16.0847 7.92399 16.0726 7.93817 16.058 7.94947C16.0363 7.96422 16.006 7.9581 15.98 7.94947C15.4064 7.77516 14.7839 7.89529 14.3161 8.27057C14.2927 8.29487 14.2581 8.28098 14.2286 8.26785C13.7606 8.06391 10.121 6.52349 9.60013 6.3022L9.60013 6.30231ZM20.4378 3.11213L23.7464 6.42554L22.9491 11.3705V11.3835C22.9484 11.3948 22.946 11.4059 22.9422 11.4165C22.9335 11.4339 22.9162 11.4373 22.8988 11.4425C22.7284 11.4942 22.5678 11.5743 22.4239 11.6795C22.4177 11.6839 22.412 11.6889 22.4066 11.6942C22.397 11.7046 22.3875 11.7142 22.3719 11.7159C22.3592 11.7163 22.3466 11.7143 22.3347 11.7098L17.2928 9.56449L17.2832 9.56023C17.2512 9.54721 17.213 9.53158 17.213 9.49862C17.1834 9.21725 17.0916 8.94601 16.9444 8.70454C16.9201 8.66463 16.8933 8.62296 16.914 8.58218L20.4378 3.11213ZM17.0303 10.5808L21.7567 12.5855C21.7827 12.5977 21.8113 12.6089 21.8226 12.6358C21.8271 12.652 21.8271 12.6691 21.8226 12.6853C21.8087 12.7547 21.7966 12.8337 21.7966 12.9135V13.0463C21.7966 13.0793 21.7628 13.0932 21.7316 13.1062L21.722 13.1096C20.9732 13.4298 11.2102 17.5989 11.1955 17.5989C11.1807 17.5989 11.1651 17.5989 11.1504 17.5842C11.1244 17.5581 11.1504 17.5217 11.1738 17.4887C11.178 17.483 11.182 17.4771 11.1859 17.4713L15.07 11.4485L15.0769 11.4381C15.0995 11.4017 15.1255 11.3609 15.1671 11.3609L15.2061 11.367C15.2945 11.3792 15.3724 11.3904 15.4513 11.3904C16.0406 11.3904 16.5866 11.1032 16.9159 10.612C16.9237 10.5988 16.9336 10.5871 16.9453 10.5772C16.9687 10.5599 17.0034 10.5686 17.0302 10.5806L17.0303 10.5808ZM11.6176 18.5519L22.2593 14.007C22.2593 14.007 22.2749 14.007 22.2897 14.0217C22.3477 14.0799 22.3971 14.1189 22.4448 14.1554L22.4682 14.1701C22.4898 14.1823 22.5115 14.1962 22.5132 14.2187C22.5132 14.2274 22.5132 14.2326 22.5114 14.2404L21.5997 19.8484L21.5964 19.871C21.5902 19.9144 21.5843 19.9639 21.5435 19.9639C21.05 19.9972 20.6048 20.2723 20.3537 20.6989L20.3494 20.7059C20.3373 20.7259 20.326 20.7449 20.3061 20.7554C20.2879 20.764 20.2645 20.7605 20.2454 20.7562L11.7588 19.0032C11.7502 19.0014 11.6271 18.5528 11.6176 18.5519L11.6176 18.5519Z" fill="url(#paint0_radial_1_13)"/>
        <defs>
        <radialGradient id="paint0_radial_1_13" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(16.5957 -16.6379) scale(33.2757 33.3602)">
        <stop stop-color="#20C6B7"/>
        <stop offset="1" stop-color="#4D9ABF"/>
        </radialGradient>
        </defs>
      </svg>
      `,
    },
    {
      id: 'github',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" id="footer-sample-full" preserveAspectRatio="xMidYMid meet" viewBox="0 0 512 139" class="iconify iconify--logos"><path fill="currentColor" d="M98.696 59.312h-43.06a2.015 2.015 0 0 0-2.013 2.014v21.053c0 1.111.902 2.015 2.012 2.015h16.799v26.157s-3.772 1.286-14.2 1.286c-12.303 0-29.49-4.496-29.49-42.288c0-37.8 17.897-42.773 34.698-42.773c14.543 0 20.809 2.56 24.795 3.794c1.253.384 2.412-.863 2.412-1.975l4.803-20.342c0-.52-.176-1.146-.769-1.571C93.064 5.527 83.187 0 58.233 0C29.488 0 0 12.23 0 71.023c0 58.795 33.76 67.556 62.21 67.556c23.555 0 37.844-10.066 37.844-10.066c.59-.325.653-1.148.653-1.526V61.326c0-1.11-.9-2.014-2.01-2.014Zm221.8-51.953c0-1.12-.888-2.024-1.999-2.024h-24.246a2.016 2.016 0 0 0-2.008 2.024l.006 46.856h-37.792V7.36c0-1.12-.892-2.024-2.001-2.024H228.21a2.014 2.014 0 0 0-2.003 2.024v126.872c0 1.12.9 2.03 2.003 2.03h24.245c1.109 0 2-.91 2-2.03V79.964h37.793l-.066 54.267c0 1.12.9 2.03 2.008 2.03h24.304c1.11 0 1.998-.91 2-2.03V7.36ZM144.37 24.322c0-8.73-7-15.786-15.635-15.786c-8.627 0-15.632 7.055-15.632 15.786c0 8.72 7.005 15.795 15.632 15.795c8.635 0 15.635-7.075 15.635-15.795Zm-1.924 83.212V48.97a2.015 2.015 0 0 0-2.006-2.021h-24.169c-1.109 0-2.1 1.144-2.1 2.256v83.905c0 2.466 1.536 3.199 3.525 3.199h21.775c2.39 0 2.975-1.173 2.975-3.239v-25.536ZM413.162 46.95h-24.06c-1.104 0-2.002.909-2.002 2.028v62.21s-6.112 4.472-14.788 4.472c-8.675 0-10.977-3.937-10.977-12.431v-54.25c0-1.12-.897-2.03-2.001-2.03h-24.419c-1.102 0-2.005.91-2.005 2.03v58.358c0 25.23 14.063 31.403 33.408 31.403c15.87 0 28.665-8.767 28.665-8.767s.61 4.62.885 5.168c.276.547.994 1.098 1.77 1.098l15.535-.068c1.102 0 2.005-.911 2.005-2.025l-.008-85.168a2.02 2.02 0 0 0-2.008-2.028Zm55.435 68.758c-8.345-.254-14.006-4.041-14.006-4.041V71.488s5.585-3.423 12.436-4.035c8.664-.776 17.013 1.841 17.013 22.51c0 21.795-3.768 26.096-15.443 25.744Zm9.49-71.483c-13.665 0-22.96 6.097-22.96 6.097V7.359a2.01 2.01 0 0 0-2-2.024h-24.315a2.013 2.013 0 0 0-2.004 2.024v126.872c0 1.12.898 2.03 2.007 2.03h16.87c.76 0 1.335-.39 1.76-1.077c.419-.682 1.024-5.85 1.024-5.85s9.942 9.422 28.763 9.422c22.096 0 34.768-11.208 34.768-50.315s-20.238-44.217-33.913-44.217ZM212.229 46.73h-18.187l-.028-24.027c0-.909-.468-1.364-1.52-1.364H167.71c-.964 0-1.481.424-1.481 1.35v24.83s-12.42 2.998-13.26 3.24a2.013 2.013 0 0 0-1.452 1.934v15.603c0 1.122.896 2.027 2.005 2.027h12.707v37.536c0 27.88 19.556 30.619 32.753 30.619c6.03 0 13.243-1.937 14.434-2.376c.72-.265 1.138-1.01 1.138-1.82l.02-17.164c0-1.119-.945-2.025-2.01-2.025c-1.06 0-3.77.431-6.562.431c-8.933 0-11.96-4.154-11.96-9.53l-.001-35.67h18.188a2.014 2.014 0 0 0 2.006-2.028V48.753c0-1.12-.897-2.022-2.006-2.022Z"></path></svg>`
    }
  ]
</script>

<div class="boxes">
  {#each $hosts as host}
    <div class="box host-account">
      <div class="logo">
        {@html getSVG(host.name)}
      </div>
      <div class="host-remove">
        <button
          on:click={() => {
            actions.hosts.delete(host.name)
          }}>Remove</button
        >
        <span class="sr-only">Go to host</span>
      </div>
    </div>
  {/each}
  {#if hostBeingConnected === 'vercel'}
    <div class="box connecting-host">
      <button class="back" on:click={() => (hostBeingConnected = null)}
        >Back to web hosts</button
      >
      <form
        on:submit|preventDefault={async () => {
          await actions.hosts.connect({
            name: 'vercel',
            token: enteredToken,
          })
          hostBeingConnected = null
          showingHosts = false
        }}
        in:fade={{ duration: 200 }}
      >
        <TextField
          bind:value={enteredToken}
          placeholder="7diizPFerd0Isu33ex9aamjT"
          button={{
            label: 'Connect',
            type: 'submit',
          }}
        >
          <p class="title">Vercel</p>
          <p class="subtitle">
            Create and enter a <a
              style="text-decoration:underline"
              target="blank"
              href="https://vercel.com/account/tokens">token</a
            > to finish connecting to your hosting account
          </p>
        </TextField>
        {#if errorMessage}
          <div class="error-message" transition:slide>
            {errorMessage}
          </div>
        {/if}
      </form>
    </div>
  {:else if hostBeingConnected === 'netlify'}
    <div class="box connecting-host">
      <button class="back" on:click={() => (hostBeingConnected = null)}
        >Back to web hosts</button
      >
      <form
        on:submit|preventDefault={async () => {
          await actions.hosts.connect({
            name: 'netlify',
            token: enteredToken,
          })
          hostBeingConnected = null
          showingHosts = false
        }}
        in:fade={{ duration: 200 }}
      >
        <TextField
          bind:value={enteredToken}
          placeholder="7diizPFerd0Isu33ex9aamjT"
          button={{
            label: 'Connect',
            type: 'submit',
          }}
        >
          <p class="title">Netlify</p>
          <p class="subtitle">
            Create and enter a <a
              style="text-decoration:underline"
              target="blank"
              href="https://app.netlify.com/user/applications/personal">token</a
            > to finish connecting to your hosting account
          </p>
        </TextField>
        {#if errorMessage}
          <div class="error-message" transition:slide>
            {errorMessage}
          </div>
        {/if}
      </form>
    </div>
  {:else if hostBeingConnected === 'github'}
    <div class="box connecting-host">
      <button class="back" on:click={() => (hostBeingConnected = null)}
        >Back to web hosts</button
      >
      <form
        on:submit|preventDefault={async () => {
          await connectGithub(enteredToken)
          hostBeingConnected = null
          showingHosts = false
        }}
        in:fade={{ duration: 200 }}
      >
        <TextField
          bind:value={enteredToken}
          placeholder="7diizPFerd0Isu33ex9aamjT"
          button={{
            label: 'Connect',
            type: 'submit',
          }}
        >
          <p class="title">Github</p>
          <p class="subtitle">
            Create and enter a <a
              style="text-decoration:underline"
              target="blank"
              href="https://github.com/settings/tokens">Personal Access Token</a
            > with repo access to finish connecting to your account
          </p>
        </TextField>
        {#if errorMessage}
          <div class="error-message" transition:slide>
            {errorMessage}
          </div>
        {/if}
      </form>
    </div>
  {/if}
  {#if !showingHosts && $hosts.length === 0}
    <footer>
      {#each buttons as button}
        <button class="link" on:click={button.onclick}>{button.label}</button>
      {/each}
      <button class="link" on:click={() => (showingHosts = true)}
        >Connect a host</button
      >
    </footer>
  {:else if !showingHosts}
    <footer>
      {#each buttons as button}
        <button class="link" on:click={button.onclick}>{button.label}</button>
      {/each}
    </footer>
  {:else if showingHosts && !hostBeingConnected}
    <div class="hosts">
      <div class="buttons" in:fade={{ duration: 200 }}>
        {#each availableHosts as host}
          <button
            class={host.id}
            on:click={() => (hostBeingConnected = host.id)}
          >
            {@html getSVG(host.id)}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style lang="postcss">
  .link {
    font-size: 0.85rem;
    color: var(--primo-color-gray-4);
    transition: text-decoration-color 0.1s, color 0.1s;
    text-decoration: underline var(--primo-color-gray-4);
    &:hover {
      text-decoration-color: var(--primo-color-primogreen);
      color: var(--primo-color-primogreen);
    }
  }
  .title {
    margin-bottom: 0.25rem;
    color: var(--primo-color-gray-1);
    font-weight: 600;
  }
  .subtitle {
    color: var(--primo-color-gray-2);
    margin-bottom: 1rem;
    font-size: var(--font-size-2);
    line-height: 1.5;
    a {
      text-decoration: underline;
      &:hover {
        color: var(--primo-color-primogreen);
      }
    }
  }
  .box {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 1rem;
    background: var(--primo-color-codeblack);

    .icon-item {
      i {
        margin-right: 5px;
      }
      a {
        text-decoration: underline;
      }
    }
    .user {
      display: grid;
      grid-template-columns: auto 1fr;
      place-items: center;
      gap: 1rem;
    }
    span:first-child {
      font-weight: 700;
    }
    a {
      text-decoration: underline;
    }
    &.host-account {
      width: 100%;
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      transition: box-shadow 0.1s;
      border-radius: var(--primo-border-radius);
      margin-bottom: 0.5rem;
      
      .host-remove button {
        font-size: 0.875rem;
        
        &:hover { text-decoration: underline }
      }
      
      .logo {
        :global(svg) {
          height: 100%;
          width: 4rem;
        }
      }

      &:hover {
        /* box-shadow: var(--primo-ring-primogreen); */
      }
      &:not(:last-child) {
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--primo-color-gray-9);
        margin-bottom: 1rem;
      }
    }
  }
  .boxes {
    display: grid;
    gap: 1rem;

    footer {
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
      text-align: right;
    }
  }
  .buttons {
    display: grid;
    gap: 0.5rem;
    grid-template-columns: 1fr 1fr;
    color: black;

    button {
      background: white;
      padding: 1rem;
      box-shadow: 0 0 0 0 var(--primo-color-primogreen);
      border-radius: var(--primo-border-radius);
      transition: box-shadow 0.1s;
      overflow: visible;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      &:not([disabled]):hover {
        box-shadow: 0 0 0 3px var(--primo-color-primogreen);
      }
      :global(svg) {
        height: 3rem;
        width: 100%;
        padding: 0 2rem;
      }
    }
  }
  .connecting-host {
    padding: 1rem;
    box-shadow: 0 0 0 1px var(--primo-color-primogreen);
    margin-top: 1rem;
    width: 100%;
    --space-y: 0;

    .back {
      color: var(--primo-color-primogreen);
      font-size: 0.75rem;
      text-decoration: underline;
      margin-bottom: 0.5rem;
    }
  }
</style>
