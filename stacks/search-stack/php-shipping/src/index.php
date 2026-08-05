<?php
declare(strict_types=1);

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Factory\AppFactory;

$host = getenv('MYSQL_HOST') ?: 'mysql';
$dbPort = getenv('MYSQL_DB_PORT') ?: '3306';
$dbName = getenv('MYSQL_DATABASE') ?: 'stacks';
$user = getenv('MYSQL_USER') ?: 'app';
$pass = getenv('MYSQL_PASSWORD') ?: 'app';
$indexer = getenv('INDEXER_URL') ?: 'http://go-indexer:8080';

function pdo(): PDO {
    global $host, $dbPort, $dbName, $user, $pass;
    static $pdo = null;
    if ($pdo === null) {
        for ($i = 0; $i < 60; $i++) {
            try {
                $pdo = new PDO("mysql:host=$host;port=$dbPort;dbname=$dbName", $user, $pass);
                $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
                $pdo->exec("CREATE TABLE IF NOT EXISTS shipments (
                    order_id VARCHAR(64) PRIMARY KEY,
                    customer_id VARCHAR(64),
                    status VARCHAR(32),
                    shipped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )");
                break;
            } catch (Throwable $e) {
                sleep(2);
            }
        }
    }
    return $pdo;
}

$app = AppFactory::create();

$app->get('/health', function (Request $req, Response $res) {
    pdo();
    $res->getBody()->write(json_encode(['status' => 'healthy', 'stack' => 'search', 'framework' => 'php']));
    return $res->withHeader('Content-Type', 'application/json');
});

$app->post('/ship', function (Request $req, Response $res) use ($indexer) {
    $body = json_decode((string)$req->getBody(), true) ?: [];
    $orderId = $body['orderId'] ?? 'ord-1';
    $customerId = $body['customerId'] ?? 'cust-1';
    $pdo = pdo();
    $stmt = $pdo->prepare("INSERT INTO shipments (order_id, customer_id, status) VALUES (?, ?, 'shipped')
        ON DUPLICATE KEY UPDATE status='shipped'");
    $stmt->execute([$orderId, $customerId]);
    error_log("[php] shipped order=$orderId");
    @file_get_contents("$indexer/index", false, stream_context_create([
        'http' => ['method' => 'POST', 'header' => "Content-Type: application/json\r\n",
            'content' => json_encode(['id' => $orderId, 'body' => "shipment $orderId"])],
    ]));
    $res->getBody()->write(json_encode(['orderId' => $orderId, 'status' => 'shipped']));
    return $res->withHeader('Content-Type', 'application/json');
});

$app->run();
