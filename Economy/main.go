// Mercury Economy service
// "imagine a blockchain but without the blocks or the chain" - Heliodex

package main

import (
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	c "github.com/TwiN/go-color"

	. "Economy/ledger"
)

const (
	folderpath = "../data/economy" // kinda jsonl file
	filepath   = folderpath + "/ledger"
	// The Site makes this key on first use (Site/src/lib/server/economy.ts),
	// readable only by the user it runs as, and sends it with every request
	keypath = folderpath + "/key"

	stipendTime = 12 * 60 * 60 * 1000
)

var currentFilepath = filepath

func toReadable(c Currency) string {
	return fmt.Sprintf("%d.%06d unit", c/Unit, c%Unit)
}

type EconomyServer struct {
	*Economy
	mu  sync.Mutex // handlers run concurrently, and the ledger's maps aren't safe for that
	key string
}

// locked runs a handler with the economy to itself, for the Site only: anything
// else that can reach the port (it's on the host's loopback) is refused
func (e *EconomyServer) locked(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		e.mu.Lock()
		defer e.mu.Unlock()
		if !e.authorised(r) {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		h(w, r)
	}
}

// authorised checks the request carries the Site's key ("Authorization: Bearer
// <key>"). The key file is read on every request, so a rotated key takes effect
// at once (the old one stops working without a restart), and the Site can make
// the key after the Economy has started.
func (e *EconomyServer) authorised(r *http.Request) bool {
	given, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	if !ok || given == "" {
		return false
	}
	b, err := os.ReadFile(keypath)
	if err != nil {
		e.key = ""
		return false
	}
	e.key = strings.TrimSpace(string(b))
	return e.key != "" && subtle.ConstantTimeCompare([]byte(given), []byte(e.key)) == 1
}

// limit reads ?limit= (how many transactions to list): 100 by default, at most 5000
func limit(r *http.Request) int {
	n, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil || n < 1 {
		return 100
	}
	return min(n, 5000)
}

func (e *EconomyServer) balancesRoute(w http.ResponseWriter, r *http.Request) {
	if err := json.NewEncoder(w).Encode(e.GetBalances()); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// func (e *EconomyServer) currentFeeRoute(w http.ResponseWriter, r *http.Request) {
// 	fmt.Fprint(w, e.GetCurrentFee())
// }

func (e *EconomyServer) currentStipendRoute(w http.ResponseWriter, r *http.Request) {
	fmt.Fprint(w, Stipend)
}

func (e *EconomyServer) balanceRoute(w http.ResponseWriter, r *http.Request) {
	var u User

	if _, err := fmt.Sscanf(r.PathValue("id"), "%s", &u); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	fmt.Fprint(w, e.GetBalance(u))
}

func (e *EconomyServer) adminTransactionsRoute(w http.ResponseWriter, r *http.Request) {
	transactions, err := e.LastNTransactions(func(tx map[string]any) bool {
		return true
	}, limit(r))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if err := json.NewEncoder(w).Encode(transactions); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (e *EconomyServer) transactionsRoute(w http.ResponseWriter, r *http.Request) {
	id := User(r.PathValue("id"))

	transactions, err := e.LastNTransactions(func(tx map[string]any) bool {
		return tx["From"] != nil && User(tx["From"].(string)) == id || tx["To"] != nil && User(tx["To"].(string)) == id
	}, limit(r))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if err := json.NewEncoder(w).Encode(transactions); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (e *EconomyServer) transactRoute(w http.ResponseWriter, r *http.Request) {
	var stx SentTx

	if err := json.NewDecoder(r.Body).Decode(&stx); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := e.Transact(stx); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	fmt.Println(c.InGreen(fmt.Sprintf("Transaction successful  %s -[%s]-> %s", stx.From, toReadable(stx.Amount), stx.To)))
}

func (e *EconomyServer) mintRoute(w http.ResponseWriter, r *http.Request) {
	var sm SentMint

	if err := json.NewDecoder(r.Body).Decode(&sm); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := e.Mint(sm); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	fmt.Println(c.InGreen(fmt.Sprintf("Mint successful         %s <-[%s]-", sm.To, toReadable(sm.Amount))))
}

func (e *EconomyServer) burnRoute(w http.ResponseWriter, r *http.Request) {
	var sb SentBurn

	if err := json.NewDecoder(r.Body).Decode(&sb); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := e.Burn(sb); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	fmt.Println(c.InGreen(fmt.Sprintf("Burn successful         %s -[%s]->", sb.From, toReadable(sb.Amount))))
}

func (e *EconomyServer) stipendRoute(w http.ResponseWriter, r *http.Request) {
	var to User

	if _, err := fmt.Sscanf(r.PathValue("id"), "%s", &to); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if e.GetPrevStipend(to)+stipendTime > uint64(time.Now().UnixMilli()) {
		http.Error(w, "Next stipend not available yet", http.StatusBadRequest)
		return
	}
	if err := e.Stipend(to); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	fmt.Println(c.InGreen(fmt.Sprintf("Stipend successful      %s", to)))
}

func createFilepath() (file *os.File, err error) {
	if file, err = os.OpenFile(currentFilepath, os.O_CREATE|os.O_APPEND|os.O_RDWR, 0o600); err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			return nil, fmt.Errorf("failed to open ledger: %w", err)
		}

		fmt.Println(c.InPurple("Economy data folder not found, creating..."))
		if err = os.MkdirAll(folderpath, 0o644); err != nil {
			return nil, fmt.Errorf("failed to create *Economy data folder: %w", err)
		}
		if file, err = os.OpenFile(currentFilepath, os.O_CREATE|os.O_APPEND|os.O_RDWR, 0o600); err != nil {
			return nil, fmt.Errorf("failed to create ledger: %w", err)
		}
	}
	// every transaction is in here: no need for anyone else to read it, so
	// tighten a ledger made with the old, world-readable mode too
	_ = file.Chmod(0o600)
	return
}

func main() {
	fmt.Println(c.InYellow("Loading ledger..."))
	// create the file if it dont exist

	file, err := createFilepath()
	if err != nil {
		fmt.Println(c.InRed("Failed to create or open ledger: " + err.Error()))
		os.Exit(1)
	}
	defer file.Close()

	e, err := NewEconomy(file)
	if err != nil {
		fmt.Println(c.InRed("Failed to create economy: " + err.Error()))
		os.Exit(1)
	}

	e.Stats()

	es := &EconomyServer{Economy: e}

	// http.HandleFunc("GET /currentFee", es.currentFeeRoute)
	http.HandleFunc("GET /currentStipend", es.locked(es.currentStipendRoute))
	http.HandleFunc("GET /balance/{id}", es.locked(es.balanceRoute))
	http.HandleFunc("GET /balances", es.locked(es.balancesRoute))
	http.HandleFunc("GET /transactions", es.locked(es.adminTransactionsRoute))
	http.HandleFunc("GET /transactions/{id}", es.locked(es.transactionsRoute))
	http.HandleFunc("POST /transact", es.locked(es.transactRoute))
	http.HandleFunc("POST /mint", es.locked(es.mintRoute))
	http.HandleFunc("POST /burn", es.locked(es.burnRoute))
	http.HandleFunc("POST /stipend/{id}", es.locked(es.stipendRoute))

	fmt.Println(c.InGreen("~ Economy service is up on port 2009 ~")) // 03/Jan/2009 Chancellor on brink of second bailout for banks
	if err := http.ListenAndServe(":2009", nil); err != nil {
		fmt.Println(c.InRed("Failed to start server: " + err.Error()))
		os.Exit(1)
	}
}
