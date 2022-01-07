<script>
  import axios from 'axios'
  import { find as _find } from 'lodash-es'
  import { fade, slide } from 'svelte/transition'
  import hosts from '../../stores/hosts'
  import * as actions from '../../actions'
  import TextField from '$lib/ui/TextField.svelte'
  import PrimaryButton from '$lib/ui/PrimaryButton.svelte'

  export let buttons = []

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
      actions.hosts.create({
        name: 'vercel',
        token,
      })
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
      hosts.update((h) => {
        return [
          ...h,
          {
            name: 'netlify',
            token,
            user: data,
          },
        ]
      })
    } else {
      window.alert('Could not connect to host')
    }
  }

  let showingHosts = false
  let errorMessage = null
  let loading = false

  let hostBeingConnected = null

  let width = 6
  const availableHosts = [
    {
      id: 'vercel',
      svg: `<svg viewBox="0 0 284 65" fill="currentColor" style="width: ${width}rem;height: 100%;"
            ><title>Vercel Logotype</title><path
              d="M141.68 16.25c-11.04 0-19 7.2-19 18s8.96 18 20 18c6.67 0 12.55-2.64 16.19-7.09l-7.65-4.42c-2.02 2.21-5.09 3.5-8.54 3.5-4.79 0-8.86-2.5-10.37-6.5h28.02c.22-1.12.35-2.28.35-3.5 0-10.79-7.96-17.99-19-17.99zm-9.46 14.5c1.25-3.99 4.67-6.5 9.45-6.5 4.79 0 8.21 2.51 9.45 6.5h-18.9zm117.14-14.5c-11.04 0-19 7.2-19 18s8.96 18 20 18c6.67 0 12.55-2.64 16.19-7.09l-7.65-4.42c-2.02 2.21-5.09 3.5-8.54 3.5-4.79 0-8.86-2.5-10.37-6.5h28.02c.22-1.12.35-2.28.35-3.5 0-10.79-7.96-17.99-19-17.99zm-9.45 14.5c1.25-3.99 4.67-6.5 9.45-6.5 4.79 0 8.21 2.51 9.45 6.5h-18.9zm-39.03 3.5c0 6 3.92 10 10 10 4.12 0 7.21-1.87 8.8-4.92l7.68 4.43c-3.18 5.3-9.14 8.49-16.48 8.49-11.05 0-19-7.2-19-18s7.96-18 19-18c7.34 0 13.29 3.19 16.48 8.49l-7.68 4.43c-1.59-3.05-4.68-4.92-8.8-4.92-6.07 0-10 4-10 10zm82.48-29v46h-9v-46h9zM37.59.25l36.95 64H.64l36.95-64zm92.38 5l-27.71 48-27.71-48h10.39l17.32 30 17.32-30h10.39zm58.91 12v9.69c-1-.29-2.06-.49-3.2-.49-5.81 0-10 4-10 10v14.8h-9v-34h9v9.2c0-5.08 5.91-9.2 13.2-9.2z"
            /></svg
          >`,
    },
    {
      id: 'netlify',
      svg: `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
        <svg
          xmlns:dc="http://purl.org/dc/elements/1.1/"
          xmlns:cc="http://creativecommons.org/ns#"
          xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
          xmlns:svg="http://www.w3.org/2000/svg"
          xmlns="http://www.w3.org/2000/svg"
          xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
          xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
          width="120"
          height="60"
          viewBox="0 0 120 60"
          version="1.1"
          id="svg18"
          sodipodi:docname="netlify-ar21.svg"
          inkscape:version="0.92.4 (5da689c313, 2019-01-14)">  
          <title
            id="title2">Netlify</title>
          <defs
            id="defs11">
            <radialGradient
              cx="52.527786"
              cy="-49.920341"
              fx="52.527786"
              fy="-49.920341"
              r="104.61749"
              gradientTransform="matrix(0.32798653,0,0,0.32881934,6.7094059,12.101607)"
              id="radialGradient-1"
              gradientUnits="userSpaceOnUse">
              <stop
                stop-color="#20C6B7"
                offset="0%"
                id="stop6" />
              <stop
                stop-color="#4D9ABF"
                offset="100%"
                id="stop8" />
            </radialGradient>
          </defs>
          <g
            id="g836"
            transform="matrix(0.96976481,0,0,0.96976481,1.4142375,0.90705594)">
            <path
              style="fill:#0e1e25;fill-rule:nonzero;stroke:none;stroke-width:0.2506941"
              inkscape:connector-curvature="0"
              id="Shape"
              d="m 50.318924,25.028803 0.0839,1.501545 c 0.957072,-1.16134 2.213613,-1.74201 3.76894,-1.74201 2.695217,0 4.067043,1.549364 4.114792,4.648094 v 8.585721 h -2.906003 v -8.417668 c 0,-0.824552 -0.177364,-1.434597 -0.532086,-1.831503 -0.354724,-0.396222 -0.935244,-0.594333 -1.740875,-0.594333 -1.172634,0 -2.046483,0.532851 -2.619497,1.597185 v 9.246319 h -2.90737 v -12.99335 h 2.739558 z m 16.629715,13.233816 c -1.841834,0 -3.335766,-0.582036 -4.479748,-1.746793 -1.144667,-1.164756 -1.716999,-2.71617 -1.716999,-4.653559 v -0.360015 c 0,-1.296603 0.248987,-2.455894 0.747648,-3.476507 0.497976,-1.020613 1.198556,-1.815107 2.099691,-2.384164 0.901135,-0.56769 1.905957,-0.851877 3.01515,-0.851877 1.762021,0 3.124296,0.564275 4.08478,1.692824 0.961845,1.129233 1.442088,2.725735 1.442088,4.791554 v 1.177053 h -8.458795 c 0.08868,1.072532 0.444769,1.920994 1.070992,2.545385 0.626224,0.624391 1.414121,0.936587 2.363005,0.936587 1.33158,0 2.416215,-0.539682 3.253907,-1.621095 l 1.566923,1.501545 c -0.51844,0.776049 -1.210153,1.378579 -2.075133,1.806909 -0.865661,0.42833 -1.836377,0.642153 -2.912827,0.642153 z M 66.602102,27.131513 c -0.798127,0 -1.441406,0.280088 -1.931879,0.840264 -0.491157,0.560176 -0.803584,1.341006 -0.939335,2.341808 h 5.539146 V 30.09703 c -0.06412,-0.976893 -0.323345,-1.714685 -0.777663,-2.215428 -0.455002,-0.50006 -1.084636,-0.750089 -1.890269,-0.750089 z m 11.436427,-5.260189 v 3.158163 h 2.285237 v 2.161459 h -2.285237 v 7.252912 c 0,0.495961 0.09823,0.853927 0.29333,1.074582 0.195097,0.219971 0.544362,0.329957 1.047116,0.329957 0.342285,-9.52e-4 0.68333,-0.0413 1.016419,-0.120233 v 2.257783 c -0.661697,0.184448 -1.299518,0.275989 -1.914142,0.275989 -2.232714,0 -3.349411,-1.236486 -3.349411,-3.710141 v -7.361532 h -2.13107 v -2.16146 h 2.129706 v -3.158162 h 2.906688 z m 7.597224,16.151512 H 82.728384 V 19.578018 h 2.907369 z m 6.256779,0 h -2.90737 V 25.029487 h 2.90737 z M 88.805755,21.654768 c 0,-0.447458 0.141206,-0.81977 0.424303,-1.116253 0.28378,-0.2958 0.6883,-0.444042 1.214246,-0.444042 0.526629,0 0.933197,0.148242 1.221069,0.444042 0.286508,0.296483 0.429762,0.668795 0.429762,1.116936 0,0.439943 -0.143254,0.806107 -0.429762,1.098491 -0.287872,0.292385 -0.69444,0.438577 -1.221069,0.438577 -0.525946,0 -0.930466,-0.146192 -1.214246,-0.438577 -0.283097,-0.291701 -0.424303,-0.658548 -0.424303,-1.098491 z m 7.27388,16.368068 V 27.190263 h -1.974174 v -2.16146 h 1.974174 v -1.188666 c 0,-1.441428 0.398383,-2.553582 1.195828,-3.338512 0.79813,-0.784246 1.914145,-1.176369 3.349407,-1.176369 0.51094,0 1.05326,0.07173 1.62764,0.215872 l -0.0716,2.281693 c -0.36686,-0.06819 -0.73951,-0.100221 -1.1126,-0.09564 -1.388199,0 -2.081958,0.715932 -2.081958,2.149163 v 1.152459 h 2.631778 v 2.16146 h -2.631778 v 10.83189 h -2.906687 z m 12.190215,-4.178776 2.63177,-8.814573 H 114 l -5.14349,14.962846 c -0.78994,2.185371 -2.12971,3.278395 -4.01998,3.278395 -0.42294,0 -0.88953,-0.07241 -1.39979,-0.216555 v -2.257782 l 0.5505,0.03621 c 0.73333,0 1.28588,-0.133896 1.65697,-0.40237 0.37042,-0.267792 0.66374,-0.717982 0.87931,-1.350571 l 0.41816,-1.116936 -4.54592,-12.933233 h 3.13453 z" />
            <path
              style="fill:url(#radialGradient-1);fill-rule:nonzero;stroke:none;stroke-width:0.32840267"
              inkscape:connector-curvature="0"
              id="path14"
              d="m 31.629584,24.750981 -0.01245,-0.0053 c -0.0072,-0.0028 -0.01431,-0.0053 -0.02056,-0.01167 -0.02078,-0.02234 -0.03002,-0.05309 -0.02502,-0.08323 l 0.690763,-4.229284 3.239345,3.244897 -3.368919,1.435414 c -0.0092,0.0038 -0.0194,0.0057 -0.02949,0.0053 h -0.0134 c -0.0044,-0.0028 -0.0089,-0.0063 -0.01786,-0.01521 -0.125378,-0.139797 -0.275305,-0.255362 -0.442339,-0.340956 z m 4.698615,-0.257731 3.463645,3.468621 c 0.719356,0.721288 1.079483,1.081037 1.210845,1.498059 0.01967,0.06176 0.03574,0.123492 0.04826,0.187034 l -8.277537,-3.510682 c -0.0044,-0.0019 -0.0089,-0.0037 -0.0134,-0.0053 -0.03306,-0.01342 -0.07149,-0.02863 -0.07149,-0.06264 0,-0.03401 0.03931,-0.05012 0.07237,-0.06353 l 0.01074,-0.0044 z m 4.581555,6.266966 c -0.178724,0.336482 -0.527235,0.685491 -1.117017,1.277018 l -3.905089,3.909806 -5.050698,-1.053293 -0.0268,-0.0053 c -0.04469,-0.0072 -0.09204,-0.01521 -0.09204,-0.05548 -0.03878,-0.421772 -0.250773,-0.808459 -0.585315,-1.067611 -0.02056,-0.02058 -0.0152,-0.0528 -0.0089,-0.08233 0,-0.0044 0,-0.0089 0.0018,-0.01258 l 0.949909,-5.8401 0.0035,-0.01969 c 0.0053,-0.04475 0.0134,-0.09665 0.05362,-0.09665 0.411209,-0.05123 0.784668,-0.265629 1.036592,-0.595106 0.008,-0.0089 0.0134,-0.0188 0.02413,-0.02417 0.02859,-0.01343 0.06255,0 0.09204,0.01258 l 8.623365,3.652971 z m -5.920187,6.086196 -6.4215,6.430732 1.099144,-6.765422 0.0018,-0.0089 c 8.87e-4,-0.0089 0.0028,-0.01789 0.0053,-0.02595 0.0089,-0.02148 0.03217,-0.03043 0.05451,-0.03938 l 0.01074,-0.0044 c 0.240665,-0.102833 0.453518,-0.261397 0.621061,-0.462662 0.02145,-0.02506 0.04736,-0.04922 0.08042,-0.0537 0.0086,-0.0014 0.01733,-0.0014 0.02591,0 l 4.52168,0.930693 z m -7.780686,7.791871 -0.723825,0.724867 -8.002303,-11.581761 c -0.0029,-0.0042 -0.0059,-0.0084 -0.0089,-0.01258 -0.01245,-0.01701 -0.02591,-0.03401 -0.02324,-0.0537 0,-0.01432 0.0099,-0.02684 0.01966,-0.03758 l 0.0089,-0.01165 c 0.02413,-0.03581 0.04469,-0.07159 0.06702,-0.110077 l 0.01787,-0.03133 0.0028,-0.0028 c 0.01258,-0.02148 0.02413,-0.04207 0.04557,-0.0537 0.01876,-0.0089 0.04469,-0.0053 0.06524,-8.87e-4 l 8.865532,1.830962 c 0.02479,0.0038 0.04817,0.01403 0.06791,0.02953 0.01165,0.01166 0.01431,0.02417 0.01698,0.03849 0.125351,0.474977 0.465199,0.863975 0.918634,1.051504 0.02502,0.01258 0.01431,0.04027 0.0028,0.0698 -0.0058,0.01297 -0.01035,0.02643 -0.0134,0.04027 -0.111702,0.680121 -1.069654,6.53096 -1.327014,8.110454 z m -1.511992,1.513273 c -0.533486,0.528883 -0.848039,0.808985 -1.203697,0.92174 -0.350674,0.111048 -0.727021,0.111048 -1.077697,0 -0.416423,-0.132444 -0.776548,-0.492192 -1.495907,-1.213476 l -8.03626,-8.047814 2.099098,-3.26011 c 0.0099,-0.01611 0.01966,-0.03043 0.03574,-0.04207 0.02233,-0.01611 0.05451,-0.0089 0.08132,0 0.4818,0.145566 0.999097,0.119314 1.463737,-0.07427 0.02413,-0.0089 0.04826,-0.01521 0.06702,0.0018 0.0095,0.0085 0.01778,0.01818 0.02502,0.02863 l 8.041621,11.68648 z m -12.588322,-9.115425 -1.843523,-1.846173 3.640578,-1.555332 c 0.0093,-0.0041 0.01933,-0.0062 0.02949,-0.0063 0.03038,0 0.04826,0.03043 0.06435,0.05816 0.03659,0.05637 0.07533,0.111296 0.116168,0.164661 l 0.01165,0.01432 c 0.01074,0.01521 0.0035,0.03043 -0.0072,0.04475 l -2.01063,3.125876 z M 10.449175,34.372917 8.1168455,32.037234 C 7.7200819,31.639901 7.4323383,31.351743 7.2321691,31.103856 l 7.0917099,1.473002 c 0.0089,0.0017 0.01784,0.0032 0.02681,0.0044 0.04379,0.0072 0.09203,0.01522 0.09203,0.05638 0,0.04475 -0.05272,0.06533 -0.09741,0.08233 l -0.02055,0.0089 z M 6.8246822,29.902904 c 0.00812,-0.15046 0.035107,-0.299295 0.080419,-0.442974 0.1322549,-0.417022 0.4914876,-0.776771 1.2117388,-1.498059 l 2.984666,-2.988955 c 1.374228,1.997303 2.752182,3.992032 4.133853,5.984177 0.02413,0.03221 0.05093,0.06802 0.02324,0.09486 -0.130473,0.144078 -0.260935,0.301579 -0.352978,0.472505 -0.01,0.02196 -0.02536,0.04106 -0.04469,0.05549 -0.01165,0.0072 -0.02413,0.0044 -0.03753,0.0018 h -0.0018 L 6.8246822,29.90201 Z m 5.0757188,-5.730026 4.011429,-4.018984 c 0.377997,0.165555 1.75148,0.746343 2.97841,1.265383 0.929357,0.393757 1.776503,0.751714 2.0428,0.868052 0.0268,0.01074 0.05093,0.02147 0.06255,0.04832 0.0072,0.01611 0.0035,0.03669 0,0.0537 -0.129046,0.589307 0.0466,1.204093 0.46736,1.635872 0.0268,0.02685 0,0.06532 -0.02324,0.09845 l -0.01245,0.0188 -4.074875,6.32066 c -0.01074,0.01789 -0.02055,0.03311 -0.03843,0.04475 -0.02145,0.01343 -0.05184,0.0072 -0.07685,8.87e-4 -0.158486,-0.04158 -0.321412,-0.06382 -0.485232,-0.06622 -0.146551,0 -0.305615,0.02685 -0.466465,0.05638 h -8.87e-4 c -0.01787,0.0028 -0.03396,0.0063 -0.04826,-0.0044 -0.0158,-0.01297 -0.02937,-0.02833 -0.04021,-0.04564 l -4.296498,-6.27591 z m 4.823723,-4.830656 5.195464,-5.202933 c 0.719359,-0.720393 1.079484,-1.081036 1.495907,-1.212587 0.350676,-0.111046 0.727023,-0.111046 1.077697,0 0.416424,0.131551 0.77655,0.492194 1.495909,1.212587 l 1.125951,1.12757 -3.695088,5.730922 c -0.0091,0.01668 -0.02161,0.0313 -0.03664,0.04295 -0.02234,0.01521 -0.05362,0.0089 -0.08043,0 -0.591442,-0.179744 -1.233349,-0.05587 -1.715737,0.331112 -0.02413,0.02506 -0.05986,0.01074 -0.09025,-0.0028 -0.48255,-0.2103 -4.235723,-1.798743 -4.772786,-2.026941 z m 11.17552,-3.289644 3.411814,3.416718 -0.822125,5.099125 v 0.01343 c -7.21e-4,0.01165 -0.0032,0.02307 -0.0072,0.03401 -0.0089,0.01789 -0.0268,0.02148 -0.04469,0.02685 -0.175774,0.05332 -0.341323,0.135909 -0.489699,0.244306 -0.0064,0.0046 -0.01231,0.0097 -0.01787,0.01521 -0.0099,0.01074 -0.01966,0.02057 -0.03574,0.02237 -0.0131,3.93e-4 -0.02614,-0.0017 -0.03843,-0.0063 l -5.199039,-2.212186 -0.0099,-0.0044 c -0.03306,-0.01342 -0.07239,-0.02954 -0.07239,-0.06353 -0.03056,-0.290139 -0.12518,-0.569838 -0.277019,-0.818831 -0.02503,-0.04116 -0.05272,-0.08413 -0.03129,-0.126176 z m -3.513685,7.701486 4.873764,2.067213 c 0.0268,0.01258 0.0563,0.02416 0.06791,0.0519 0.0047,0.01669 0.0047,0.03432 0,0.05101 -0.01431,0.07159 -0.0268,0.153029 -0.0268,0.235359 v 0.136919 c 0,0.03401 -0.03485,0.04832 -0.06702,0.06176 l -0.0099,0.0035 c -0.772082,0.330217 -10.839524,4.629304 -10.854716,4.629304 -0.01519,0 -0.03128,0 -0.04646,-0.01521 -0.0268,-0.02684 0,-0.06444 0.02413,-0.09845 0.0043,-0.0059 0.0084,-0.01192 0.01245,-0.01789 l 4.005172,-6.210587 0.0072,-0.01074 c 0.02324,-0.03758 0.05004,-0.07965 0.09293,-0.07965 l 0.04022,0.0063 c 0.09115,0.01258 0.171572,0.02415 0.252892,0.02415 0.607656,0 1.170633,-0.296209 1.510205,-0.802721 0.0081,-0.01354 0.01835,-0.02562 0.03038,-0.03581 0.02413,-0.01789 0.05987,-0.0089 0.08757,0.0035 z m -5.581504,8.219633 10.973562,-4.686577 c 0,0 0.01608,0 0.03128,0.01521 0.05987,0.05996 0.110811,0.100225 0.159956,0.137815 l 0.02413,0.01521 c 0.02233,0.01258 0.04469,0.02684 0.04646,0.05012 0,0.0089 0,0.01432 -0.0019,0.02237 l -0.940081,5.782824 -0.0035,0.02327 c -0.0063,0.04475 -0.01245,0.09576 -0.05451,0.09576 -0.508829,0.0344 -0.967933,0.318022 -1.226931,0.757978 l -0.0044,0.0072 c -0.01245,0.02059 -0.02413,0.04027 -0.04469,0.05101 -0.01876,0.0089 -0.04289,0.0053 -0.06255,8.87e-4 l -8.751149,-1.807692 c -0.0089,-0.0018 -0.135829,-0.464451 -0.145658,-0.465346 z" />
          </g>
        </svg>
        `,
    },
  ]

  // $: getAccountData($user.tokens)

  let enteredToken
</script>

<div class="boxes">
  {#each $hosts as host}
    <div class="box host-account">
      <div class="user">
        {@html _find(availableHosts, ['id', host.name])['svg']}
      </div>
      <div class="host-user">
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
        on:submit|preventDefault={() => {
          connectVercel(enteredToken)
          hostBeingConnected = null
        }}
        in:fade={{ duration: 200 }}
      >
        <TextField
          bind:value={enteredToken}
          placeholder="7diizPFerd0Isu33ex9aamjT"
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
          await connectNetlify(enteredToken)
          hostBeingConnected = null
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
            {@html host.svg}
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
      text-decoration-color: var(--primo-color-primored);
      color: var(--primo-color-primored);
    }
  }
  .heading {
    margin-bottom: 1rem;
    font-size: 0.75rem;
    color: var(--primo-color-gray-4);
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
        color: var(--primo-color-primored);
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
    .box-footer {
      font-size: 0.75rem;
      color: var(--primo-color-gray-5);
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
    .hosts {
      width: 100%;
      display: grid;
      gap: 0.5rem;
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

      &:hover {
        /* box-shadow: var(--primo-ring-primored); */
      }
      &:not(:last-child) {
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--primo-color-gray-9);
        margin-bottom: 1rem;
      }
      img {
        width: 3rem;
        height: 3rem;
        object-fit: contain;
        border-radius: 50%;
      }
      .user-details {
        display: flex;
        flex-direction: column;
        align-items: flex-start;

        .footer {
          margin-top: 0.25rem;
          font-size: 0.75rem;
          color: var(--primo-color-gray-5);
        }
      }
    }
    /* .deployment {
      display: flex;
      flex-direction: column;

      span:last-child {
        font-size: 0.75rem;
        color: var(--primo-color-gray-3);
      }
    } */
    .link {
      align-self: flex-end;
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
      box-shadow: 0 0 0 0 var(--primo-color-primored);
      border-radius: var(--primo-border-radius);
      transition: box-shadow 0.1s;
      overflow: visible;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      svg {
        width: 6rem;
        height: 100%;
        padding: 1rem 0;
      }
      &:not([disabled]):hover {
        box-shadow: 0 0 0 3px var(--primo-color-primored);
      }
      &[disabled] {
        cursor: initial;
        opacity: 0.5;
      }
    }
  }

  .connecting-host {
    padding: 1rem;
    box-shadow: 0 0 0 1px var(--primo-color-primored);
    margin-top: 1rem;
    width: 100%;
    --space-y: 0;

    .back {
      color: var(--primo-color-primored);
      font-size: 0.75rem;
      text-decoration: underline;
      margin-bottom: 0.5rem;
    }

    label {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      margin-bottom: 1rem;

      input {
        border: 0;
        width: 100%;
        background: var(--primo-color-gray-8);
        color: var(--primo-color-gray-1);
      }
    }
    .submit-button {
      display: flex;
      justify-content: flex-end;
      margin-top: 1rem;
    }
  }
</style>
