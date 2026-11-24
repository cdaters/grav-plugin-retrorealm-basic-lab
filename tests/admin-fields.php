<?php
declare(strict_types=1);
// Exercise the actual Admin2 event/field derivation without installing Grav in this source repo.
namespace Grav\Common { class Plugin {} class Grav {public static function instance(): array {return ['config'=>new class {public function get($key,$fallback=[]){return [];}}];}} }
namespace RocketTheme\Toolbox\Event { class Event extends \ArrayObject {} }
namespace {
 $root=dirname(__DIR__);$tmp=sys_get_temp_dir().'/basic-lab-admin-'.bin2hex(random_bytes(8));mkdir($tmp);mkdir($tmp.'/classes');mkdir($tmp.'/games');
 try {
  copy($root.'/retrorealm-basic-lab.php',$tmp.'/retrorealm-basic-lab.php');foreach(glob($root.'/classes/*.php') as $f)copy($f,$tmp.'/classes/'.basename($f));
  $native=json_decode(file_get_contents($root.'/examples/signal-station/manifest.json'),true);
  $program=$native;$program['id']='new-program';$program['adapter']='basic-interpreter';$program['draft']=false;$program['entrypoint']='assets/games/new-program/index.html';
  file_put_contents($tmp.'/games/signal-station.json',json_encode($native));file_put_contents($tmp.'/games/new-program.json',json_encode($program));
  require $tmp.'/retrorealm-basic-lab.php';$fields=\Grav\Plugin\RetrorealmBasicLabPlugin::gameFields();
  if(count($fields)!==12 || $fields['game__signal-station__published']['default']!==false || $fields['game__new-program__published']['default']!==true)throw new \Exception('Manifest-derived publication/fields failed');
  $event=new \RocketTheme\Toolbox\Event\Event(['context'=>'plugin','plugin'=>'retrorealm-basic-lab','fields'=>[]]);$plugin=new \Grav\Plugin\RetrorealmBasicLabPlugin();$plugin->onApiBlueprintResolved($event);
  if(count($event['fields'])!==12 || $event['fields'][0]['name']!=='game__new-program__enabled')throw new \Exception('Admin2 field event failed');
  unlink($tmp.'/games/new-program.json');if(count(\Grav\Plugin\RetrorealmBasicLabPlugin::gameFields())!==6)throw new \Exception('Module removal left fields');
  echo "PASS: actual Admin2 event derives fields for two modules, draft defaults and removal\n";
 } finally {foreach(glob($tmp.'/classes/*') as $f)unlink($f);foreach(glob($tmp.'/games/*') as $f)unlink($f);unlink($tmp.'/retrorealm-basic-lab.php');rmdir($tmp.'/classes');rmdir($tmp.'/games');rmdir($tmp);}
}
