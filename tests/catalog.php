<?php
declare(strict_types=1);
require __DIR__.'/../classes/Catalog.php';
require __DIR__.'/../classes/Environments.php';
use Grav\Plugin\RetrorealmBasicLab\Catalog;
use Grav\Plugin\RetrorealmBasicLab\Environments;
function check($ok,$message){if(!$ok)throw new Exception($message);}
check(Catalog::manualFragment('<h1 id="title">Title</h1><h2>Manual</h2>')==='<h2 id="title">Title</h2><h2>Manual</h2>', 'manual headings retain the page h1 hierarchy');
$original=json_decode(file_get_contents(__DIR__.'/../examples/signal-station/manifest.json'),true,512,JSON_THROW_ON_ERROR);
$dir=sys_get_temp_dir().'/basic-lab-'.bin2hex(random_bytes(8));mkdir($dir);
try {
 file_put_contents($dir.'/signal-station.json',json_encode($original));check(count(Catalog::read($dir))===1,'original native manifest');
 $second=$original;$second['id']='another-program';$second['adapter']='basic-interpreter';$second['entrypoint']='assets/games/another-program/index.html';file_put_contents($dir.'/another-program.json',json_encode($second));check(count(Catalog::read($dir))===2,'additional program requires no catalog code change');unlink($dir.'/another-program.json');
 foreach(['id','entrypoint','references','active','exhibit'] as $key){$bad=$original;$bad[$key]=match($key){'id'=>'../escape','entrypoint'=>'https://example.com/code.js','references'=>['javascript:alert(1)'],'active'=>'yes','exhibit'=>['heading'=>'x','description'=>'x','facts'=>[['label'=>['not text'],'value'=>'x']]]};file_put_contents($dir.'/signal-station.json',json_encode($bad));try{Catalog::read($dir);throw new LogicException('Unsafe field accepted: '.$key);}catch(UnexpectedValueException $ok){}}
 foreach(['/../../admin','//example.com','/bad?query','/safe/../bad','javascript:alert(1)'] as $path){try{Catalog::route($path);throw new LogicException('Unsafe route');}catch(UnexpectedValueException $ok){}}
 check(Catalog::route('/projects/new-program')==='/projects/new-program','normal route');check(count(Environments::read(__DIR__.'/../environments'))===1,'bundled environment');
} finally {foreach(glob($dir.'/*') as $f)unlink($f);rmdir($dir);}
echo "PASS: native/program registration, exhibit validation, environment and unsafe route rejection\n";
