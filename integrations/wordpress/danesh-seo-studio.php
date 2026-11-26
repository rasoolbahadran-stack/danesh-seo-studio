<?php
/**
 * Plugin Name: Danesh SEO Studio Connector
 * Description: اتصال سایت وردپرسی به Danesh SEO Studio از طریق قرارداد REST — فهرست صفحات، دریافت و ذخیره محتوا، تگ تأیید مالکیت.
 * Version: 0.1.0
 * Author: Danesh SEO Studio
 * Text Domain: danesh-seo-studio
 */

if (!defined('ABSPATH')) exit;

class DaneshSeoStudioConnector {

    public function __construct() {
        add_action('rest_api_init', [$this, 'registerRoutes']);
        add_action('wp_head', [$this, 'verificationMeta'], 1);
        add_action('admin_menu', [$this, 'adminMenu']);
        add_action('admin_init', [$this, 'adminSettings']);
    }

    /** ---------- REST contract (used by RestContractConnector) ---------- */
    public function registerRoutes() {
        $ns = 'danesh-seo/v1';

        register_rest_route($ns, '/ping', [
            'methods' => 'GET',
            'callback' => fn() => rest_ensure_response([
                'ok' => true,
                'site' => get_bloginfo('name'),
                'contract' => 'danesh-seo-v1',
            ]),
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/pages', [
            'methods' => 'GET',
            'callback' => [$this, 'listPages'],
            'permission_callback' => fn() => current_user_can('edit_posts'),
        ]);

        register_rest_route($ns, '/pages/(?P<id>\d+)', [
            'methods' => 'GET',
            'callback' => [$this, 'getPage'],
            'permission_callback' => fn() => current_user_can('edit_posts'),
            'args' => ['id' => ['validate_callback' => 'is_numeric']],
        ]);

        register_rest_route($ns, '/pages', [
            'methods' => 'POST',
            'callback' => [$this, 'pushPage'],
            'permission_callback' => fn() => current_user_can('edit_posts'),
        ]);
    }

    private function rowFromPost(WP_Post $post): array {
        return [
            'id' => (string) $post->ID,
            'title' => get_the_title($post),
            'url' => get_permalink($post),
            'contentHtml' => apply_filters('the_content', $post->post_content),
            'status' => $post->post_status,
            'updatedAt' => get_post_modified_time('c', true, $post),
        ];
    }

    public function listPages(WP_REST_Request $req) {
        $limit = min(max((int) ($req->get_param('limit') ?: 50), 1), 100);
        $query = new WP_Query([
            'post_type' => ['post', 'page'],
            'post_status' => ['publish', 'draft', 'pending'],
            'posts_per_page' => $limit,
            'orderby' => 'modified',
            'order' => 'DESC',
        ]);
        $pages = [];
        foreach ($query->posts as $post) $pages[] = $this->rowFromPost($post);
        return rest_ensure_response($pages);
    }

    public function getPage(WP_REST_Request $req) {
        $post = get_post((int) $req['id']);
        if (!$post) return new WP_Error('not_found', 'صفحه یافت نشد', ['status' => 404]);
        return rest_ensure_response($this->rowFromPost($post));
    }

    public function pushPage(WP_REST_Request $req) {
        $title = sanitize_text_field($req->get_param('title'));
        $html = wp_kses_post($req->get_param('html'));
        $slug = sanitize_title((string) $req->get_param('slug'));
        $status = in_array($req->get_param('status'), ['draft', 'publish'], true) ? $req->get_param('status') : 'draft';
        $metaDescription = sanitize_text_field((string) $req->get_param('metaDescription'));

        if (!$title) return new WP_Error('bad_request', 'عنوان الزامی است', ['status' => 400]);

        $postId = wp_insert_post([
            'post_title' => $title,
            'post_content' => $html,
            'post_name' => $slug,
            'post_status' => $status,
            'post_type' => 'page',
            'post_excerpt' => $metaDescription,
        ], true);

        if (is_wp_error($postId)) {
            return new WP_Error('push_failed', $postId->get_error_message(), ['status' => 500]);
        }
        return rest_ensure_response([
            'ok' => true,
            'id' => (string) $postId,
            'url' => get_permalink($postId),
        ]);
    }

    /** ---------- domain verification meta tag ---------- */
    public function verificationMeta() {
        $token = get_option('danesh_seo_verification_token', '');
        if ($token) {
            printf('<meta name="danesh-seo-studio" content="%s" />' . "\n", esc_attr($token));
        }
    }

    /** ---------- admin settings ---------- */
    public function adminMenu() {
        add_options_page('Danesh SEO Studio', 'Danesh SEO Studio', 'manage_options', 'danesh-seo-studio', [$this, 'settingsPage']);
    }

    public function adminSettings() {
        register_setting('danesh_seo_group', 'danesh_seo_verification_token', ['sanitize_callback' => 'sanitize_text_field']);
        register_setting('danesh_seo_group', 'danesh_seo_webhook_secret', ['sanitize_callback' => 'sanitize_text_field']);
    }

    public function settingsPage() {
        $token = get_option('danesh_seo_verification_token', '');
        $secret = get_option('danesh_seo_webhook_secret', '');
        echo '<div class="wrap"><h1>Danesh SEO Studio Connector</h1>';
        echo '<p>این افزونه قرارداد REST دانش سئو استودیو را فراهم می‌کند. در پنل Danesh، نوع اتصال را «REST Contract» و Base URL را آدرس همین سایت قرار دهید و با Application Password احراز هویت کنید.</p>';
        echo '<form method="post" action="options.php">';
        settings_fields('danesh_seo_group');
        echo '<table class="form-table">';
        echo '<tr><th>توکن تأیید مالکیت دامنه</th><td><input type="text" class="regular-text" name="danesh_seo_verification_token" value="' . esc_attr($token) . '"><p class="description">در پنل Danesh تولید و اینجا قرار می‌گیرد؛ به‌صورت متا تگ در head چاپ می‌شود.</p></td></tr>';
        echo '<tr><th>Webhook Secret</th><td><input type="text" class="regular-text" name="danesh_seo_webhook_secret" value="' . esc_attr($secret) . '"><p class="description">برای اعتبارسنجی امضای HMAC وب‌هوک‌های Danesh.</p></td></tr>';
        echo '</table>';
        submit_button();
        echo '</form></div>';
    }
}

new DaneshSeoStudioConnector();
