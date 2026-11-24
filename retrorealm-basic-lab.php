<?php
declare(strict_types=1);
namespace Grav\Plugin;

use Grav\Common\Plugin;
use Grav\Common\Grav;
use Grav\Common\Page\Page;
use Grav\Plugin\RetrorealmBasicLab\Catalog;
use RocketTheme\Toolbox\Event\Event;
require_once __DIR__ . '/classes/Catalog.php';
require_once __DIR__ . '/classes/Environments.php';
use Grav\Plugin\RetrorealmBasicLab\Environments;

final class RetrorealmBasicLabPlugin extends Plugin
{
    public static function getSubscribedEvents(): array
    {
        return ['onPluginsInitialized' => ['onPluginsInitialized', 0], 'onApiBlueprintResolved' => ['onApiBlueprintResolved', 0]];
    }

    /** Installed manifests are the ONLY source of games and editions; no code uploads. */
    public static function gameFields(): array
    {
        $fields = [];
        $config = Grav::instance()['config']->get('plugins.retrorealm-basic-lab', []);
        foreach (Catalog::read(__DIR__ . '/games', false) as $id => $game) {
            $prefix = 'game__' . $id . '__';
            $legacyConfig = $config['games'][$id] ?? [];
            $title = $game['title'];
            foreach (['enabled' => 'Enable', 'published' => 'Publish routes for'] as $key => $label) {
                $fields[$prefix . $key] = ['type'=>'toggle', 'label'=>"$label $title", 'help'=> $key === 'published' ? 'Draft hides Grav routes. Static files are not access controlled. Install only content authorized for this site.' : $game['description'], 'highlight'=>1, 'default'=>$legacyConfig[$key] ?? ($key === 'enabled' || !$game['draft']), 'options'=>[1=>$key==='enabled'?'Enabled':'Published',0=>$key==='enabled'?'Disabled':'Draft'], 'validate'=>['type'=>'bool']];
            }
            $fields[$prefix.'route'] = ['type'=>'text','label'=>"$title route",'default'=>$legacyConfig['route']??'','help'=>'Empty uses the catalog prefix and installed game ID. Do not use Admin/API or an existing content route.','validate'=>['type'=>'string']];
            $legacy = $legacyConfig['ruleset'] ?? $config['ruleset'] ?? '';
            $fields[$prefix.'ruleset'] = ['type'=>'select','label'=>"$title edition",'default'=>in_array($legacy,$game['rulesets'],true)?$legacy:$game['defaultRuleset'],'options'=>$game['editions']];
            $fields[$prefix.'columns'] = ['type'=>'select','label'=>"$title columns",'default'=>$legacyConfig['columns']??$config['columns']??80,'options'=>[40=>'40 columns',80=>'80 columns'],'validate'=>['type'=>'int']];
            $fields[$prefix.'theme'] = ['type'=>'select','label'=>"$title phosphor",'default'=>$legacyConfig['theme']??$config['theme']??'green','options'=>['green'=>'Green','amber'=>'Amber','white'=>'White']];
        }
        return $fields;
    }

    /** Admin 2 serializes plugin blueprints without init(); use its explicit API hook. */
    public function onApiBlueprintResolved(Event $event): void
    {
        if (($event['context'] ?? '') !== 'plugin' || ($event['plugin'] ?? '') !== 'retrorealm-basic-lab') return;
        $fields = $event['fields'];
        foreach (self::gameFields() as $name => $field) {
            $field['name'] = $name;
            if (isset($field['options'])) {
                $options=[];foreach($field['options'] as $value=>$label)$options[]=['value'=>(string)$value,'label'=>$label];$field['options']=$options;
            }
            if ($field['type']==='select' && isset($field['default'])) $field['default']=(string)$field['default'];
            $fields[]=$field;
        }
        $event['fields']=$fields;
    }

    public function onPluginsInitialized(): void
    {
        // Materialize trusted manifest defaults for the config API too. This
        // makes Admin's dirty-field comparison see explicit initial values,
        // including true/false when a user toggles back after a prior save.
        $settings = $this->config->get('plugins.retrorealm-basic-lab', []);
        foreach (self::gameFields() as $name => $field) {
            if (!array_key_exists($name, $settings) && array_key_exists('default', $field)) {
                $this->config->set('plugins.retrorealm-basic-lab.' . $name, $field['default']);
            }
        }
        if ($this->isAdmin() || !$this->config->get('plugins.retrorealm-basic-lab.enabled', false)) return;
        if ($this->reserved('/' . trim((string)$this->grav['uri']->path(),'/'))) return;
        $this->enable(['onTwigTemplatePaths'=>['onTwigTemplatePaths',0],'onPagesInitialized'=>['onPagesInitialized',100]]);
    }
    private function reserved(string $path): bool
    {
        foreach (['plugins.admin.route','plugins.admin2.route','plugins.api.route'] as $key) {
            $prefix=rtrim((string)$this->config->get($key,$key==='plugins.api.route'?'/api':'/admin'),'/');
            if($prefix && ($path===$prefix || str_starts_with($path,$prefix.'/')))return true;
        }
        return false;
    }
    public function onTwigTemplatePaths(): void { $this->grav['twig']->twig_paths[]=__DIR__.'/templates'; }
    public function onPagesInitialized(): void
    {
        try {
            $settings=$this->config->get('plugins.retrorealm-basic-lab',[]);
            $base=Catalog::route((string)($settings['route']??'/basic-lab'));
            if($this->reserved($base))throw new \UnexpectedValueException('Reserved catalog route.');
            $request=rtrim((string)$this->grav['uri']->route(),'/');
            $root=rtrim((string)$this->grav['uri']->rootUrl(false),'/');
            $visible=[];$routes=[];$environments=[];
            if (!empty($settings['basic_session'])) {
                foreach (Environments::read(__DIR__.'/environments') as $id=>$environment) {
                    $route=$base.'/session/'.$id;
                    $routes[$route]=true;
                    $environments[$id]=['route'=>$root.$route,'localRoute'=>$route,'catalog_route'=>$root.$base,'environment'=>$environment,'player'=>$root.'/user/plugins/retrorealm-basic-lab/'.$environment['entrypoint']];
                }
            }
            $this->grav['twig']->twig_vars['basic_lab_environments']=$environments;
            foreach(Catalog::read(__DIR__.'/games', false) as $id=>$game) {
                $config=$settings['games'][$id]??[];
                // Grav compiles configuration before runtime manifest fields exist.
                // Flat per-game overrides survive Admin's environment diff/merge;
                // keep legacy nested values as fallbacks for existing installations.
                foreach(['enabled','published','route','ruleset','columns','theme','saves','exports','source_links','provenance'] as $key) {
                    $field='game__'.$id.'__'.$key;
                    if(array_key_exists($field,$settings))$config[$key]=$settings[$field];
                }
                if(!$game['active'] || !($config['enabled']??true) || !($config['published']??!$game['draft']))continue;
                $route=Catalog::route(($config['route']??'')?:$base.'/'.$id);
                if($this->reserved($route) || $route===$base || isset($routes[$route]) || isset($routes[$route.'/play']))throw new \UnexpectedValueException('Conflicting game route.');
                $routes[$route]=true;$routes[$route.'/play']=true;
                $edition=$config['ruleset']??$settings['ruleset']??$game['defaultRuleset'];
                $columns=$config['columns']??$settings['columns']??80;$theme=$config['theme']??$settings['theme']??'green';
                $options=['ruleset'=>in_array($edition,$game['rulesets'],true)?$edition:$game['defaultRuleset'],'columns'=>in_array((int)$columns,[40,80],true)?(int)$columns:80,'theme'=>in_array($theme,['green','amber','white'],true)?$theme:'green'];
                foreach(['saves'=>'saves','exports'=>'exports','sources'=>'source_links','provenance'=>'provenance'] as $query=>$key)$options[$query]=!empty($config[$key]??$settings[$key])?'1':'0';
                // Build-owned editorial fragment; never sourced from Admin/user HTML.
                $manualPath=__DIR__.'/assets/games/'.$id.'/manual.html';
                $manual=is_file($manualPath)?Catalog::manualFragment(file_get_contents($manualPath)):'';
                if($options['sources']==='0')$manual=preg_replace('/<p id="source-links">.*?<\/p>/s','',$manual);
                if($options['provenance']==='0')$manual=preg_replace('/<details id="provenance">.*?<\/details>/s','',$manual);
                $visible[$id]=['catalog_route'=>$root.$base,'manual'=>$manual,'game'=>$game,'route'=>$root.$route,'localRoute'=>$route,'player'=>$root.'/user/plugins/retrorealm-basic-lab/'.$game['entrypoint'].'?'.http_build_query($options),'source_links'=>!empty($settings['source_links'])];
            }
            if($this->grav['pages']->find($request))return;
            foreach($environments as $entry){if($request!==$entry['localRoute'])continue;$this->grav['twig']->twig_vars['basic_environment']=$entry;$this->addPage($request,'basic-lab-session',$entry['environment']['title']);return;}
            if($request===$base){$this->grav['twig']->twig_vars['basic_lab_catalog']=$visible;$this->addPage($request,'basic-lab-catalog','RetroRealm BASIC Lab');return;}
            foreach($visible as $entry){$route=$entry['localRoute'];if(!in_array($request,[$route,$route.'/play'],true))continue;$this->grav['twig']->twig_vars['basic_lab']=$entry;$this->addPage($request,$request===$route?'basic-lab-detail':'basic-lab-play',($request===$route?'':'Play ').$entry['game']['title']);return;}
        }catch(\Throwable $error){$this->grav['log']->error('BASIC Lab configuration rejected: '.$error->getMessage());}
    }
    private function addPage(string $route,string $template,string $title): void
    {
        $page=new Page();$page->init(new \SplFileInfo(__DIR__.'/pages/'.$template.'.md'));
        $header=$page->header();$header->title=$title;$page->header($header);
        $page->route($route);$page->routable(true);$page->visible(false);$this->grav['pages']->addPage($page,$route);
    }
}
