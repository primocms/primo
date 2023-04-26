<script>
  export let letter = 'b'
</script>

<span class="letter">
  <span class="inner-letter">{letter}</span>
</span>

<style>
  .letter {
    height: 26px;
    width: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #81a6fd;
    color: white;
    font-weight: 400;
    font-size: 14px;
    line-height: 0;
    border-radius: 50%;
  }
  .inner-letter {
    position: relative;
    /* top: -2px; */
  }
</style>
